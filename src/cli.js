const { Command } = require('commander');
const path = require('path');
const { Analyzer } = require('./analyzer');
const { formatReport } = require('./reporter');
const fs = require('fs');

const program = new Command();

program
  .name('css-analyzer')
  .description('Static code analysis tool for detecting unused and undefined CSS classes')
  .version('1.0.0')
  .argument('[dir]', 'Project root directory', '.')
  .option('-i, --ignore <patterns...>', 'Regex patterns to ignore class names')
  .option('-f, --format <format>', 'Output format (console, json)', 'console')
  .option('-o, --output <file>', 'Output file path')
  .action(async (dir, options) => {
    const rootDir = path.resolve(process.cwd(), dir);
    
    console.log(`Analyzing project at ${rootDir}...`);
    
    const analyzer = new Analyzer(rootDir, {
      ignorePatterns: options.ignore || []
    });

    try {
      const issues = await analyzer.run();
      const report = formatReport(issues, rootDir, options.format);

      if (options.output) {
        fs.writeFileSync(options.output, report);
        console.log(`Report written to ${options.output}`);
      } else {
        console.log(report);
      }
      
      // Exit code
      const errors = issues.filter(i => i.type === 'undefined');
      if (errors.length > 0) {
        process.exit(1);
      }
    } catch (e) {
      console.error('Analysis failed:', e);
      process.exit(1);
    }
  });

program.parse();
