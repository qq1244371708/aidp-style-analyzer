
const path = require('path');
const fs = require('fs');
const resolve = require('resolve');
const fg = require('fast-glob');
// Tailwind CSS v4 API
const { compile } = require('tailwindcss');

async function createTailwindContext(rootDir) {
  // 1. Find config file
  const configFiles = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs'];
  let configPath = null;
  
  for (const file of configFiles) {
    const p = path.join(rootDir, file);
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  try {
    // 2. Prepare CSS input with @config and @import
    // v4 requires @import "tailwindcss" to load defaults.
    let cssInput = '@import "tailwindcss";';
    
    if (configPath) {
        // Use relative path for cleaner output, but absolute is safer.
        // We normalize backslashes to forward slashes for CSS string compatibility.
        const normalizedConfigPath = configPath.split(path.sep).join('/');
        cssInput = `@config "${normalizedConfigPath}";\n${cssInput}`;
    }

    // 3. Setup loadStylesheet
    const loadStylesheet = async (id, basedir) => {
        if (id === 'tailwindcss') {
            try {
                // Try to find tailwindcss/index.css
                let tailwindCssPath;
                try {
                    // Try to resolve from user project first
                    tailwindCssPath = resolve.sync('tailwindcss/index.css', { basedir: rootDir });
                } catch (e) {
                    // Fallback to our own dependency
                    tailwindCssPath = require.resolve('tailwindcss/index.css');
                }
                const content = await fs.promises.readFile(tailwindCssPath, 'utf-8');
                return { base: path.dirname(tailwindCssPath), content };
            } catch (e) {
                // Fallback: if resolve fails, maybe we are in a weird environment.
                throw e;
            }
        }
        
        // Handle other imports
        const fullPath = path.resolve(basedir, id);
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        return { base: path.dirname(fullPath), content };
    };

    // 4. Compile to get the build function
    // We pass rootDir as base for relative imports resolution
    const { build } = await compile(cssInput, {
        base: rootDir,
        loadStylesheet
    });
    
    // 5. Cache the base CSS (no utilities added)
    // build([]) returns the CSS generated from the input (preflight + theme + base styles).
    const baseCSS = build([]);

    return {
      isTailwindClass: (className) => {
        // Check if building with this class produces different CSS than base
        try {
            const result = build([className]);
            // If the output is different, it means the class generated something.
            if (result !== baseCSS) return true;
        } catch (e) {
            // Ignore build errors
        }
        
        // Manual whitelist for markers that might not generate CSS directly
        // (though 'group' usually does in v4 if used correctly, safe to keep)
        if (['group', 'peer', 'dark'].includes(className)) return true;
        if (className.startsWith('group/') || className.startsWith('peer/')) return true;
         
        return false;
      }
    };

  } catch (err) {
    console.error('Error initializing Tailwind v4:', err);
    return null;
  }
}

module.exports = { createTailwindContext };
