import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json'));

const externals = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'fs', 'path', 'events', 'util', 'os', 'child_process', 'assert', 'module'
];

export default [
  // Library Build
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/index.mjs',
        format: 'es',
        sourcemap: true
      }
    ],
    external: externals,
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      json()
    ]
  },
  // CLI Build
  {
    input: 'src/cli.js',
    output: {
      file: 'dist/cli.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
      sourcemap: true
    },
    external: externals,
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      json()
    ]
  }
];
