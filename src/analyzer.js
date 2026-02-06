// 引入依赖：文件系统（Promise 版）、路径处理、项目遍历器、Tailwind 上下文构建器以及各类解析器
const fs = require('fs').promises;
const path = require('path');
const { traverseProject } = require('./traverser');
const { createTailwindContext } = require('./tailwind');
const { parseCss } = require('./parsers/css');
const { parseScript } = require('./parsers/script');
const { parseVue } = require('./parsers/vue');
const { parseHtml } = require('./parsers/html');

/**
 * Analyzer 类：负责扫描项目文件，收集 CSS 类名的定义与使用，最终输出未使用或未定义的类名列表
 */
class Analyzer {
  /**
   * 构造函数
   * @param {string} rootDir - 项目根目录
   * @param {Object} options - 可选配置，如 ignorePatterns（自定义忽略正则数组）
   */
  constructor(rootDir, options = {}) {
    this.rootDir = rootDir;
    this.options = options;
    // 存储类名定义：Map<类名, 定义数组>
    this.definitions = new Map(); // className -> Array<{ file, line, scoped }>
    // 存储类名使用：Map<类名, 使用数组>
    this.usages = new Map(); // className -> Array<{ file, line }>
    // Tailwind 上下文，用于识别 Tailwind 官方类名
    this.tailwindContext = null;
    // 将用户传入的忽略模式字符串转换为正则实例数组
    this.customIgnorePatterns = (options.ignorePatterns || []).map(p => new RegExp(p));
  }

  /**
   * 初始化：创建 Tailwind 上下文，供后续判断类名是否属于 Tailwind
   */
  async init() {
    this.tailwindContext = await createTailwindContext(this.rootDir);
  }

  /**
   * 判断给定类名是否应被排除（用户自定义正则或 Tailwind 官方类名）
   * @param {string} className - 待检测的类名
   * @returns {boolean} -  true 表示应排除，false 表示需参与后续分析
   */
  isExcluded(className) {
    // 1. 检查用户自定义正则
    if (this.customIgnorePatterns.some(p => p.test(className))) {
      return true;
    }
    // 2. 检查是否为 Tailwind 官方类名
    if (this.tailwindContext && this.tailwindContext.isTailwindClass(className)) {
      return true;
    }
    return false;
  }

  /**
   * 向 definitions 映射中添加一条类名定义记录
   * @param {Object} def - 定义对象，至少包含 className、file、line、scoped 等字段
   */
  addDefinition(def) {
    if (!this.definitions.has(def.className)) {
      this.definitions.set(def.className, []);
    }
    this.definitions.get(def.className).push(def);
  }

  /**
   * 向 usages 映射中添加一条类名使用记录
   * @param {Object} usage - 使用对象，至少包含 className、file、line 等字段
   */
  addUsage(usage) {
    if (!this.usages.has(usage.className)) {
      this.usages.set(usage.className, []);
    }
    this.usages.get(usage.className).push(usage);
  }

  /**
   * 主流程：读取项目所有文件，按类型调用对应解析器，收集定义与使用，最后执行分析
   * @returns {Array<Object>} - 返回未使用与未定义类名的汇总数组
   */
  async run() {
    await this.init();
    // 遍历项目，获取所有待扫描文件路径
    const files = await traverseProject(this.rootDir);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const ext = path.extname(file);

      // 根据扩展名调用不同解析器
      if (['.css', '.scss', '.less'].includes(ext)) {
        // 样式文件：提取类名定义
        const defs = await parseCss(content, file);
        defs.forEach(d => this.addDefinition(d));
      } else if (['.jsx', '.tsx', '.js'].includes(ext)) {
        // JS/TS 文件：提取类名使用
        const usgs = await parseScript(content, file);
        usgs.forEach(u => this.addUsage(u));
      } else if (ext === '.vue') {
        // Vue 单文件：同时提取定义与使用
        const result = await parseVue(content, file);
        result.definitions.forEach(d => this.addDefinition(d));
        result.usages.forEach(u => this.addUsage(u));
      } else if (ext === '.html') {
        // HTML 文件：提取类名使用
        const usgs = await parseHtml(content, file);
        usgs.forEach(u => this.addUsage(u));
      }
    }

    return this.analyze();
  }

  /**
   * 分析收集到的定义与使用，输出未使用与未定义类名列表
   * @returns {Array<Object>} - 合并后的未使用与未定义类名数组
   */
  analyze() {
    const unused = [];        // 未使用类名结果
    const undefinedClasses = []; // 未定义类名结果

    // 1. 检测未使用类名
    for (const [className, defs] of this.definitions) {
      // 若为 Tailwind 类或被用户忽略，则跳过
      if (this.isExcluded(className)) continue;

      for (const def of defs) {
        let isUsed = false;
        const fileUsages = this.usages.get(className);

        if (fileUsages) {
          if (def.scoped === 'global') {
            // 全局作用域定义：只要被用过就算使用
            isUsed = true;
          } else {
            // 文件作用域定义：必须在同一文件内使用
            isUsed = fileUsages.some(u => u.file === def.scoped);
          }
        }

        if (!isUsed) {
          unused.push({
            type: 'unused',
            className,
            file: def.file,
            line: def.line
          });
        }
      }
    }

    // 2. 检测未定义类名
    for (const [className, usgs] of this.usages) {
      // 若为 Tailwind 类或被用户忽略，则跳过
      if (this.isExcluded(className)) continue;

      const defs = this.definitions.get(className);

      for (const usage of usgs) {
        // 若置信度为 low（如 JS 中可能是随机字符串），且未匹配到定义，则视为误报，跳过
        // 默认置信度为 high
        const confidence = usage.confidence || 'high';

        let isDefined = false;
        if (defs) {
          // 检查可见性：全局定义 或 同一文件内定义
          isDefined = defs.some(d => d.scoped === 'global' || d.scoped === usage.file);
        }

        if (!isDefined && confidence === 'high') {
          undefinedClasses.push({
            type: 'undefined',
            className,
            file: usage.file,
            line: usage.line
          });
        }
      }
    }

    // 合并结果并返回
    return [...unused, ...undefinedClasses];
  }
}

// 导出 Analyzer 类供外部使用
module.exports = { Analyzer };
