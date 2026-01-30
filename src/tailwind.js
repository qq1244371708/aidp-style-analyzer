const path = require('path');
const fs = require('fs');
const resolve = require('resolve');
const fg = require('fast-glob');

async function createTailwindContext(rootDir) {
  // 1. Try to find standard tailwind.config.js/ts
  const configFiles = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'];
  let configPath = null;
  
  for (const file of configFiles) {
    const p = path.join(rootDir, file);
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  try {
    let tailwindPath;
    try {
      tailwindPath = resolve.sync('tailwindcss', { basedir: rootDir });
    } catch (e) {
      tailwindPath = require.resolve('tailwindcss');
    }

    const tailwindRoot = path.dirname(require.resolve('tailwindcss/package.json', { paths: [path.dirname(tailwindPath)] }));
    const createContext = require(path.join(tailwindRoot, 'lib/lib/setupContextUtils')).createContext;
    const resolveConfig = require(path.join(tailwindRoot, 'resolveConfig'));
    
    let userConfig = {};

    if (configPath) {
        try {
             // Try standard require first (works for CJS)
             userConfig = require(configPath);
         } catch (e) {
             if (e.code === 'ERR_REQUIRE_ESM') {
                 // Try dynamic import for ESM
                 const imported = await import(configPath);
                 userConfig = imported.default || imported;
             } else {
                  console.warn('Failed to load Tailwind config from file:', e.message);
             }
         }
    } else {
        // 2. Fallback: Search for inline config in HTML files
        // Heuristic: Search for <script>tailwind.config = { ... }</script>
        try {
            const htmlFiles = await fg('**/*.html', { cwd: rootDir, absolute: true, ignore: ['**/node_modules/**'] });
            for (const file of htmlFiles) {
                const content = fs.readFileSync(file, 'utf-8');
                // Regex to find tailwind.config = { ... }
                // This is very simple and brittle, but might work for simple cases
                const match = content.match(/tailwind\.config\s*=\s*({[\s\S]*?});/);
                if (match && match[1]) {
                    try {
                        // Use a safe evaluation or Function to parse object literal
                        // We need to be careful. eval is dangerous.
                        // But since we are running locally on user's code...
                        // Let's use Function constructor to parse object
                        const configStr = match[1];
                        // Replace unquoted keys if necessary? JSON.parse is strict.
                        // Object literal might have unquoted keys.
                        const getObj = new Function(`return ${configStr}`);
                        userConfig = getObj();
                        console.log(`Loaded inline Tailwind config from ${path.relative(rootDir, file)}`);
                        break; // Only load first one
                    } catch (e) {
                        console.warn('Found inline tailwind config but failed to parse:', e.message);
                    }
                }
            }
        } catch (e) {
            console.warn('Error searching for inline HTML config:', e.message);
        }
    }

    const resolvedConfig = resolveConfig(userConfig.default || userConfig);
    const context = createContext(resolvedConfig);
    
    return {
      isTailwindClass: (className) => {
        // Context has `candidateRuleMap`.
        const results = context.candidateRuleMap.get(className);
        if (results) return true;
        
        try {
            const generateRules = require(path.join(tailwindRoot, 'lib/lib/generateRules')).generateRules;
            const rules = generateRules([className], context);
            if (rules && rules.length > 0) return true;
        } catch (e) {
            // Fallback
        }
        
         // Manual whitelist for markers that might not generate rules but are valid
         if (['group', 'peer', 'dark'].includes(className)) return true;
         // Handle named groups/peers (e.g. group/item, peer/input)
         if (className.startsWith('group/') || className.startsWith('peer/')) return true;
         
         return false;
       }
     };

  } catch (err) {
    console.error('Error loading Tailwind config/context:', err);
    return null;
  }
}

module.exports = { createTailwindContext };
