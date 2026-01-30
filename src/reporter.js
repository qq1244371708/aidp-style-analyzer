const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

function formatReport(issues, rootDir, format = 'console') {
  if (format === 'json') {
    return JSON.stringify(issues, null, 2);
  }

  if (issues.length === 0) {
    return chalk.green('No issues found!');
  }

  // Group by file
  const byFile = {};
  issues.forEach(issue => {
    if (!byFile[issue.file]) {
      byFile[issue.file] = [];
    }
    byFile[issue.file].push(issue);
  });

  let output = '';

  Object.keys(byFile).sort().forEach(file => {
    const relPath = path.relative(rootDir, file);
    output += chalk.underline(relPath) + '\n';
    
    byFile[file].sort((a, b) => a.line - b.line).forEach(issue => {
      const lineStr = `${issue.line}`;
      const typeStr = issue.type === 'unused' 
        ? chalk.yellow('Unused CSS class definition') 
        : chalk.red('Undefined CSS class reference');
      
      output += `  ${chalk.gray(lineStr.padEnd(4))} ${typeStr}: ${chalk.cyan(issue.className)}\n`;
    });
    output += '\n';
  });

  return output;
}

module.exports = { formatReport };
