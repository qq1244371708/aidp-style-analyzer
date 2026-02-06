// 引入 commander 库，用于构建命令行界面
const { Command } = require('commander');
// 引入 path 模块，用于处理和转换文件路径
const path = require('path');
// 引入自定义的 Analyzer 类，负责执行 CSS 类分析
const { Analyzer } = require('./analyzer');
// 引入自定义的 formatReport 函数，用于格式化分析结果
const { formatReport } = require('./reporter');
// 引入 fs 模块，用于文件系统操作
const fs = require('fs');

// 创建一个新的命令行程序实例
const program = new Command();

// 配置命令行程序的基本信息、参数和选项
program
  .name('css-analyzer')
  .description('Static code analysis tool for detecting unused and undefined CSS classes')
  .version('1.0.0')
  .argument('[dir]', 'Project root directory', '.')
  .option('-i, --ignore <patterns...>', 'Regex patterns to ignore class names')
  .option('-f, --format <format>', 'Output format (console, json)', 'console')
  .option('-o, --output <file>', 'Output file path')
  // 定义命令执行时的异步处理函数
  .action(async (dir, options) => {
    // 解析并确定项目根目录的绝对路径
    const rootDir = path.resolve(process.cwd(), dir);
    
    console.log(`Analyzing project at ${rootDir}...`);
    
    // 创建 Analyzer 实例，传入根目录和忽略模式
    const analyzer = new Analyzer(rootDir, {
      ignorePatterns: options.ignore || []
    });

    try {
      // 执行分析，获取发现的问题列表
      const issues = await analyzer.run();
      // 根据指定格式生成报告
      const report = formatReport(issues, rootDir, options.format);

      // 如果指定了输出文件，则将报告写入文件；否则输出到控制台
      if (options.output) {
        fs.writeFileSync(options.output, report);
        console.log(`Report written to ${options.output}`);
      } else {
        console.log(report);
      }
      
      // Exit code
      // 如果存在未定义的 CSS 类错误，则以错误码 1 退出进程
      const errors = issues.filter(i => i.type === 'undefined');
      if (errors.length > 0) {
        process.exit(1);
      }
    } catch (e) {
      // 捕获并处理分析过程中的异常，打印错误信息并以错误码 1 退出
      console.error('Analysis failed:', e);
      process.exit(1);
    }
  });

// 解析命令行参数并执行对应动作
program.parse();
