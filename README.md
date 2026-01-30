# AIDP Style Analyzer

A frontend static code analysis tool for detecting unused and undefined CSS classes in your projects. It deeply parses Vue, React, HTML, and style files, with intelligent support for Tailwind CSS.

## Features

1.  **Detect Unused CSS Classes**: Scans CSS/SCSS/LESS and Vue `<style>` to report classes defined but not used in templates.
2.  **Detect Undefined CSS Classes**: Scans HTML/JSX/TSX and Vue `<template>` to report classes used but not defined in stylesheets.
3.  **Framework Support**:
    *   **Vue**: Deep parsing of `.vue` SFCs (supports `<template>` and `<style scoped>`).
    *   **React**: Supports `.jsx` and `.tsx`.
4.  **Tailwind CSS Integration**: Automatically reads `tailwind.config.js` to identify and validate Tailwind utility classes (ignoring generated utilities to prevent false positives).
5.  **Preprocessors**: Supports `.scss`, `.less`, and standard `.css`.
6.  **Customizable Exclusion**: Support ignoring specific class name patterns via regex.

## Installation

```bash
npm install aidp-style-analyzer --save-dev
```

## Usage

### CLI

Run the analyzer on your project directory:

```bash
npx aidp-style-analyzer [directory] [options]
```

**Options:**

*   `[directory]`: Root directory of the target project (default: current directory).
*   `-i, --ignore <patterns...>`: Regex patterns to ignore class names (e.g., `^js-` for JavaScript hooks).
*   `-f, --format <format>`: Output format. Supports `console` (default) or `json`.
*   `-o, --output <file>`: Output the report to a specified file.

**Examples:**

Analyze the current directory:
```bash
npx aidp-style-analyzer .
```

Analyze a specific project and ignore classes starting with `test-` or `js-`:
```bash
npx aidp-style-analyzer ./src -i "^test-" "^js-"
```

Output a JSON report:
```bash
npx aidp-style-analyzer ./src -f json -o report.json
```

### API

You can also use the analyzer programmatically in your Node.js scripts:

```javascript
const { Analyzer, formatReport } = require('aidp-style-analyzer');
const path = require('path');

async function run() {
  const rootDir = path.resolve(__dirname, './src');
  const analyzer = new Analyzer(rootDir, {
    ignorePatterns: ['^js-']
  });

  const issues = await analyzer.run();
  
  // Print report to console
  console.log(formatReport(issues, rootDir, 'console'));
  
  // Or process issues manually
  issues.forEach(issue => {
    if (issue.type === 'undefined') {
      console.error(`Undefined class "${issue.name}" in ${issue.file}:${issue.line}`);
    }
  });
}

run();
```

## Caveats

*   **Tailwind Configuration**: The tool attempts to load the target project's `tailwind.config.js`. Loading may fail if the configuration uses complex runtime logic or non-standard environment dependencies.
*   **Dynamic Class Names**: Dynamically constructed class names (e.g., `'btn-' + type`) cannot be fully identified by static analysis. It is recommended to use complete class name strings or add them to the ignore list.

---

# AIDP Style Analyzer

一款前端静态代码分析工具，专注于检测项目中未使用和未定义的 CSS 类。它能够深度解析 Vue、React、HTML 及样式文件，并智能支持 Tailwind CSS。

## 功能特性

1.  **检测未使用的 CSS 类**：扫描 CSS/SCSS/LESS 及 Vue `<style>`，报告那些已定义但在模板中未被引用的类。
2.  **检测未定义的 CSS 类**：扫描 HTML/JSX/TSX 及 Vue `<template>`，报告那些已使用但在样式表中未定义的类。
3.  **主流框架支持**：
    *   **Vue**：深度解析 `.vue` 单文件组件（支持 `<template>` 和 `<style scoped>`）。
    *   **React**：支持 `.jsx` 和 `.tsx` 文件。
4.  **Tailwind CSS 智能集成**：自动读取项目的 `tailwind.config.js`，识别并验证 Tailwind 实用类（自动忽略生成的实用类以防止误报）。
5.  **预处理器支持**：支持 `.scss`、`.less` 以及标准 `.css` 文件。
6.  **自定义排除**：支持通过正则表达式模式忽略特定的类名。

## 安装

```bash
npm install aidp-style-analyzer --save-dev
```

## 使用方法

### 命令行 (CLI)

在项目目录下运行分析器：

```bash
npx aidp-style-analyzer [directory] [options]
```

**选项：**

*   `[directory]`: 目标项目的根目录（默认为当前目录）。
*   `-i, --ignore <patterns...>`: 忽略类名的正则表达式模式（例如：`^js-` 用于忽略 JavaScript 钩子类名）。
*   `-f, --format <format>`: 输出格式。支持 `console`（默认）或 `json`。
*   `-o, --output <file>`: 将报告输出到指定文件。

**示例：**

分析当前目录：
```bash
npx aidp-style-analyzer .
```

分析指定项目并忽略以 `test-` 或 `js-` 开头的类：
```bash
npx aidp-style-analyzer ./src -i "^test-" "^js-"
```

输出 JSON 格式的报告：
```bash
npx aidp-style-analyzer ./src -f json -o report.json
```

### API 调用

您也可以在 Node.js 脚本中以编程方式使用分析器：

```javascript
const { Analyzer, formatReport } = require('aidp-style-analyzer');
const path = require('path');

async function run() {
  const rootDir = path.resolve(__dirname, './src');
  const analyzer = new Analyzer(rootDir, {
    ignorePatterns: ['^js-']
  });

  const issues = await analyzer.run();
  
  // 将报告打印到控制台
  console.log(formatReport(issues, rootDir, 'console'));
  
  // 或者手动处理问题数据
  issues.forEach(issue => {
    if (issue.type === 'undefined') {
      console.error(`未定义的类 "${issue.name}" 位于 ${issue.file}:${issue.line}`);
    }
  });
}

run();
```

## 注意事项

*   **Tailwind 配置**：工具会尝试加载目标项目的 `tailwind.config.js`。如果配置文件使用了复杂的运行时逻辑或非标准的环境依赖，可能会导致加载失败。
*   **动态类名**：静态分析无法完全识别动态拼接的类名（例如 `'btn-' + type`）。建议使用完整的类名字符串，或将其模式添加到忽略列表中。
