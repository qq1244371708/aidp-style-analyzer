const { parse } = require('@vue/compiler-sfc');
const { compileTemplate } = require('@vue/compiler-sfc');
const { parseCss } = require('./css');
const { parseScript, extractClassesFromNode } = require('./script'); // We might reuse logic
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

async function parseVue(content, filePath) {
  const definitions = [];
  const usages = [];

  try {
    const { descriptor } = parse(content, { filename: filePath });

    // 1. Styles -> Definitions
    for (const style of descriptor.styles) {
      const styleDefs = await parseCss(style.content, filePath, { 
        scoped: style.scoped 
      });
      definitions.push(...styleDefs);
    }

    // 2. Template -> Usages
    if (descriptor.template) {
        // Compile template to get AST or Render function?
        // compiler-sfc exposes AST in the descriptor? No, we need to compile.
        // Actually, parse() returns descriptor, which has 'template' block content.
        // We need to parse the template content.
        
        // We can use @vue/compiler-dom directly to parse template to AST.
        const compilerDom = require('@vue/compiler-dom');
        const ast = compilerDom.parse(descriptor.template.content);
        
        // Traverse Vue AST
        // We need a walker.
        function walk(node) {
            if (node.props) {
                node.props.forEach(prop => {
                    // Static class: class="foo"
                    if (prop.name === 'class' && prop.type === 6 /* NodeTypes.ATTRIBUTE */) {
                        if (prop.value) {
                             const classes = prop.value.content.split(/\s+/).filter(Boolean);
                             classes.forEach(cls => {
                                 usages.push({
                                     className: cls,
                                     file: filePath,
                                     line: prop.loc.start.line + (descriptor.template.loc.start.line - 1)
                                 });
                             });
                        }
                    }
                    // Dynamic class: :class="..." or v-bind:class="..."
                    if (prop.name === 'bind' && prop.arg && prop.arg.content === 'class') {
                        // prop.exp is the expression
                        if (prop.exp && prop.exp.content) {
                            // We need to parse the expression content as JS and find strings.
                            // This is similar to script parsing.
                            try {
                                // Wrap in () to ensure it parses as expression
                                const exprAst = parser.parseExpression(prop.exp.content, {
                                    plugins: ['jsx']
                                });
                                
                                // Traverse expression AST to find strings and object keys
                                // :class="{ 'active': isActive }" -> 'active'
                                // :class="['text-red', isTrue ? 'bg-blue' : '']" -> 'text-red', 'bg-blue'
                                
                                // Simple manual traversal or use babel traverse on a dummy file
                                // Let's use simple recursion for the AST nodes we care about
                                
                                function extractFromExpr(node) {
                                    if (!node) return;
                                    if (node.type === 'StringLiteral') {
                                        const classes = node.value.split(/\s+/).filter(Boolean);
                                        classes.forEach(cls => {
                                            usages.push({
                                                className: cls,
                                                file: filePath,
                                                line: prop.loc.start.line + (descriptor.template.loc.start.line - 1)
                                            });
                                        });
                                    } else if (node.type === 'ObjectExpression') {
                                        node.properties.forEach(p => {
                                            if (p.key.type === 'StringLiteral') {
                                                const classes = p.key.value.split(/\s+/).filter(Boolean);
                                                classes.forEach(cls => {
                                                    usages.push({
                                                        className: cls,
                                                        file: filePath,
                                                        line: prop.loc.start.line + (descriptor.template.loc.start.line - 1)
                                                    });
                                                });
                                            } else if (p.key.type === 'Identifier') {
                                                // :class="{ active: isActive }" -> 'active'
                                                 usages.push({
                                                    className: p.key.name,
                                                    file: filePath,
                                                    line: prop.loc.start.line + (descriptor.template.loc.start.line - 1)
                                                });
                                            }
                                        });
                                    } else if (node.type === 'ArrayExpression') {
                                        node.elements.forEach(extractFromExpr);
                                    } else if (node.type === 'ConditionalExpression') {
                                        extractFromExpr(node.consequent);
                                        extractFromExpr(node.alternate);
                                    }
                                }
                                
                                extractFromExpr(exprAst);

                            } catch (e) {
                                // Ignore parse errors in expressions
                            }
                        }
                    }
                });
            }
            
            if (node.children) {
                node.children.forEach(walk);
            }
        }
        
        walk(ast);
    }

    // 3. Script / ScriptSetup -> Usages
    // We can parse script content just like a JS/TS file
    const scripts = [descriptor.script, descriptor.scriptSetup].filter(Boolean);
    for (const script of scripts) {
        const scriptUsages = await parseScript(script.content, filePath);
        // Adjust lines
        scriptUsages.forEach(u => {
            u.line += (script.loc.start.line - 1);
        });
        usages.push(...scriptUsages);
    }

  } catch (e) {
    console.error(`Error parsing Vue ${filePath}:`, e.message);
  }

  return { definitions, usages };
}

module.exports = { parseVue };
