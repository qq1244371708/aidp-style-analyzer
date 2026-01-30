const fs = require('fs').promises;
const path = require('path');
const { traverseProject } = require('./traverser');
const { createTailwindContext } = require('./tailwind');
const { parseCss } = require('./parsers/css');
const { parseScript } = require('./parsers/script');
const { parseVue } = require('./parsers/vue');
const { parseHtml } = require('./parsers/html');

class Analyzer {
  constructor(rootDir, options = {}) {
    this.rootDir = rootDir;
    this.options = options;
    this.definitions = new Map(); // className -> Array<{ file, line, scoped }>
    this.usages = new Map(); // className -> Array<{ file, line }>
    this.tailwindContext = null;
    this.customIgnorePatterns = (options.ignorePatterns || []).map(p => new RegExp(p));
  }

  async init() {
    this.tailwindContext = await createTailwindContext(this.rootDir);
  }

  isExcluded(className) {
    // 1. Check custom patterns
    if (this.customIgnorePatterns.some(p => p.test(className))) {
      return true;
    }
    // 2. Check Tailwind
    if (this.tailwindContext && this.tailwindContext.isTailwindClass(className)) {
      return true;
    }
    return false;
  }

  addDefinition(def) {
    if (!this.definitions.has(def.className)) {
      this.definitions.set(def.className, []);
    }
    this.definitions.get(def.className).push(def);
  }

  addUsage(usage) {
    if (!this.usages.has(usage.className)) {
      this.usages.set(usage.className, []);
    }
    this.usages.get(usage.className).push(usage);
  }

  async run() {
    await this.init();
    const files = await traverseProject(this.rootDir);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const ext = path.extname(file);

      if (['.css', '.scss', '.less'].includes(ext)) {
        const defs = await parseCss(content, file);
        defs.forEach(d => this.addDefinition(d));
      } else if (['.jsx', '.tsx', '.js'].includes(ext)) {
        const usgs = await parseScript(content, file);
        usgs.forEach(u => this.addUsage(u));
      } else if (ext === '.vue') {
        const result = await parseVue(content, file);
        result.definitions.forEach(d => this.addDefinition(d));
        result.usages.forEach(u => this.addUsage(u));
      } else if (ext === '.html') {
        const usgs = await parseHtml(content, file);
        usgs.forEach(u => this.addUsage(u));
      }
    }

    return this.analyze();
  }

  analyze() {
    const unused = [];
    const undefinedClasses = [];

    // 1. Detect Unused
    for (const [className, defs] of this.definitions) {
      // If it's a tailwind class or excluded, skip
      if (this.isExcluded(className)) continue;

      for (const def of defs) {
        let isUsed = false;
        const fileUsages = this.usages.get(className);

        if (fileUsages) {
          if (def.scoped === 'global') {
            isUsed = true;
          } else {
            // Scoped: must be used in the same file
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

    // 2. Detect Undefined
    for (const [className, usgs] of this.usages) {
      // If it's a tailwind class or excluded, skip
      if (this.isExcluded(className)) continue;

      // Check if defined
      const defs = this.definitions.get(className);
      
      for (const usage of usgs) {
        // If confidence is low (e.g. random string in JS), do NOT report as undefined
        // unless it matches a defined class (which is handled by logic above, here defs is undefined)
        // Wait, if defs is undefined, it means it's NOT defined.
        // So if confidence is low AND it's not defined -> ignore (likely false positive)
        // If confidence is high AND it's not defined -> report
        
        // However, usage object doesn't have 'confidence' property in my previous `addUsage` logic?
        // Wait, `parseScript` adds `confidence`. `parseHtml` adds `confidence`.
        // `addUsage` just stores the object. So `usage.confidence` should be there.
        // Default confidence for `parseVue` / `parseCss`? 
        // `parseVue` -> usages need confidence too. I should update `parseVue`.
        // But for now, let's assume 'high' if undefined.
        
        const confidence = usage.confidence || 'high';
        
        let isDefined = false;
        if (defs) {
          // Check visibility
          isDefined = defs.some(d => d.scoped === 'global' || d.scoped === usage.file);
        }

        if (!isDefined) {
          // Only report if confidence is high
          if (confidence === 'high') {
             undefinedClasses.push({
                type: 'undefined',
                className,
                file: usage.file,
                line: usage.line
            });
          }
        }
      }
    }

    return [...unused, ...undefinedClasses];
  }
}

module.exports = { Analyzer };
