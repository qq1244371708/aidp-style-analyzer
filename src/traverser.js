const fg = require('fast-glob');
const path = require('path');
const fs = require('fs');

async function traverseProject(rootDir) {
  const patterns = [
    '**/*.css',
    '**/*.scss',
    '**/*.less',
    '**/*.vue',
    '**/*.jsx',
    '**/*.tsx',
    '**/*.html',
    '**/*.js'
  ];

  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
  ];

  const entries = await fg(patterns, {
    cwd: rootDir,
    ignore,
    absolute: true,
    stats: false
  });

  return entries;
}

module.exports = { traverseProject };
