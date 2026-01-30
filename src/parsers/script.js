const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs').promises;
const { parseHtml } = require('./html');

// Helper to handle both standard strings and HTML strings
async function processStringValue(value, usages, filePath, startLine) {
    if (!value) return;
    
    // Heuristic: If it looks like HTML, try to parse as HTML
    if (value.trim().startsWith('<')) {
        const htmlUsages = await parseHtml(value, filePath, startLine - 1);
        if (htmlUsages.length > 0) {
            usages.push(...htmlUsages);
            return;
        }
    }
    
    // Fallback: Greedy split for potential classes
    const classes = value.split(/\s+/).filter(Boolean);
    classes.forEach(cls => {
        // Only consider it a class if it looks valid (simple regex)
        // This avoids too much garbage, but must be permissive for tailwind
        if (/^[a-zA-Z0-9-_:/]+$/.test(cls)) {
             usages.push({
                className: cls,
                file: filePath,
                line: startLine,
                confidence: 'low' // Mark as low confidence
            });
        }
    });
}

function extractClassesFromNode(node, usages, filePath, lineOffset = 0) {
    if (!node) return;

    if (node.type === 'StringLiteral') {
        // Standard string
        // We can't do async inside synchronous visitor easily if we want to wait.
        // But we are collecting promises? No, visitors are sync usually.
        // We'll have to collect strings and process later or use synchronous processing.
        // `parseHtml` uses @vue/compiler-dom which is sync. So we can make `parseHtml` sync or use it sync.
        // Actually my `parseHtml` implementation is sync but wrapped in async.
        // Let's assume we can call `parseHtml` synchronously if we remove async.
        
        // Wait, `processStringValue` logic above uses `await`.
        // I need to refactor `parseHtml` to be sync (it is internally sync).
    }
}

// Refactor to sync for visitor
function parseHtmlSync(content, filePath, lineOffset = 0) {
  const { parse } = require('@vue/compiler-dom');
  const usages = [];
  
  function traverseHtmlAst(node) {
      if (node.props) {
        node.props.forEach(prop => {
          if (prop.name === 'class' && prop.type === 6) {
            if (prop.value) {
              const classes = prop.value.content.split(/\s+/).filter(Boolean);
              classes.forEach(cls => {
                usages.push({
                  className: cls,
                  file: filePath,
                  line: (prop.loc.start.line) + lineOffset,
                  confidence: 'high'
                });
              });
            }
          }
        });
      }
      if (node.children) {
        node.children.forEach(traverseHtmlAst);
      }
  }

  try {
    const ast = parse(content);
    if (ast.children) {
        ast.children.forEach(traverseHtmlAst);
    }
  } catch (e) {}
  return usages;
}

function processStringValueSync(value, usages, filePath, startLine) {
    if (!value) return;
    
    // HTML check
    if (value.trim().startsWith('<')) {
        const htmlUsages = parseHtmlSync(value, filePath, startLine - 1);
        if (htmlUsages.length > 0) {
            usages.push(...htmlUsages);
            return;
        }
    }
    
    // Fallback: Greedy split
    const classes = value.split(/\s+/).filter(Boolean);
    classes.forEach(cls => {
        // Permissive regex for tailwind classes (including brackets, slash, colon)
        // e.g. w-[20%] group-hover:opacity-0
        if (/^[a-zA-Z0-9-_:/\[\]%.]+$/.test(cls)) {
             usages.push({
                className: cls,
                file: filePath,
                line: startLine,
                confidence: 'low'
            });
        }
    });
}

async function parseScript(content, filePath) {
  const usages = [];
  
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
      errorRecovery: true
    });

    traverse(ast, {
      // 1. Handle JSX className / class (High Confidence)
      JSXAttribute(path) {
        const node = path.node;
        const name = node.name.name;
        if (name === 'className' || name === 'class') {
          if (node.value && node.value.type === 'StringLiteral') {
             const classes = node.value.value.split(/\s+/).filter(Boolean);
             classes.forEach(cls => usages.push({
                 className: cls,
                 file: filePath,
                 line: node.loc.start.line,
                 confidence: 'high'
             }));
          }
        }
      },
      
      // 2. Handle Template Literals (Potential HTML or Class List)
      TemplateLiteral(path) {
          const node = path.node;
          // Combine quasis to get full string if it's simple?
          // If it has expressions `${...}`, we can only check the static parts or try to reconstruct.
          // For simplicity, let's check each quasi (string part).
          // But for HTML `<div class="...">`, the class might be split if `${}` is inside.
          // However, in `iButton.js`, it is `class="${...}"`.
          // The static part is `class="`. The value is dynamic.
          // This is hard.
          
          // But look at `home.js`: `this.innerHTML = \` ... <div class="fixed ..."> ... \``
          // Here the classes are in the static quasis!
          // So traversing quasis is good.
          
          node.quasis.forEach(quasi => {
              if (quasi.value.raw) {
                   processStringValueSync(quasi.value.raw, usages, filePath, quasi.loc.start.line);
              }
          });
      },
      
      // 3. Handle String Literals (Potential HTML or Class List)
      StringLiteral(path) {
          // Skip if it's inside JSX attribute (handled above)
          if (path.parent.type === 'JSXAttribute') return;
          
          processStringValueSync(path.node.value, usages, filePath, path.node.loc.start.line);
      }
    });

  } catch (e) {
    // console.error(`Error parsing script ${filePath}:`, e.message);
  }

  return usages;
}

module.exports = { parseScript, extractClassesFromNode };
