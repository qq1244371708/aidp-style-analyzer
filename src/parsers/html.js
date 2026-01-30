const { parse } = require('@vue/compiler-dom');

function traverseHtmlAst(node, usages, filePath, lineOffset = 0) {
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
              line: (prop.loc.start.line) + lineOffset
            });
          });
        }
      }
    });
  }

  if (node.children) {
    node.children.forEach(child => traverseHtmlAst(child, usages, filePath, lineOffset));
  }
}

async function parseHtml(content, filePath, lineOffset = 0) {
  const usages = [];
  try {
    const ast = parse(content);
    // @vue/compiler-dom returns a RootNode which has children
    if (ast.children) {
        ast.children.forEach(child => traverseHtmlAst(child, usages, filePath, lineOffset));
    }
  } catch (e) {
    // console.error(`Error parsing HTML ${filePath}:`, e.message);
    // HTML parsing might fail on fragments, ignore silently or log verbose
  }
  return usages;
}

module.exports = { parseHtml };
