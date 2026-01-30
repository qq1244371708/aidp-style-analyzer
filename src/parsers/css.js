const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');
const fs = require('fs').promises;
const path = require('path');

async function parseCss(content, filePath, options = {}) {
  const { scoped = false } = options;
  const definitions = [];
  
  const processor = postcss([
    (root) => {
      root.walkRules((rule) => {
        selectorParser((selectors) => {
          selectors.walkClasses((classNode) => {
            definitions.push({
              className: classNode.value,
              line: rule.source.start.line, // Use rule start or selector start? Selector is better if available, but rule is easier.
              // classNode.source might be available if we set it up, but postcss-selector-parser usually works on string.
              // To get exact line of class, we need more mapping. For now, rule line is close enough.
              file: filePath,
              scoped: scoped ? filePath : 'global'
            });
          });
        }).processSync(rule.selector);
      });
    }
  ]);

  // Handle different syntaxes based on extension
  const ext = path.extname(filePath);
  const processOptions = { from: filePath };
  
  if (ext === '.scss') {
    processOptions.parser = require('postcss-scss');
  } else if (ext === '.less') {
    processOptions.parser = require('postcss-less');
  }

  try {
    await processor.process(content, processOptions);
  } catch (e) {
    console.error(`Error parsing CSS ${filePath}:`, e.message);
  }

  return definitions;
}

module.exports = { parseCss };
