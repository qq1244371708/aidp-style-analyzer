# 前端静态代码分析工具 (CSS Analyzer) 技术总结报告

本文档对位于 `/Users/breeze/Work/personal-project/AIDP/src/` 的前端静态代码分析工具进行全面的技术总结。该工具旨在通过 AST（抽象语法树）分析和静态规则引擎，检测项目中的 CSS 类定义与使用情况，支持现代前端开发流程（Vue, React, Tailwind CSS）。

---

## 1. 项目结构与模块概述

项目采用模块化架构，核心逻辑与解析层分离，确保了高扩展性和可维护性。

- **`cli.js`**: CLI 入口文件。负责处理命令行参数（路径、忽略模式、输出格式），初始化分析器，并处理最终的进程退出状态。
- **`analyzer.js`**: 核心业务类 `Analyzer`。负责编排整个分析流程，包括初始化环境、遍历文件、调度解析器、聚合数据以及执行分析算法。
- **`traverser.js`**: 文件系统遍历模块。利用 `fast-glob` 高效扫描指定类型的源文件。
- **`tailwind.js`**: Tailwind CSS 集成模块。负责加载配置文件（支持文件及 HTML 内联配置），创建 Tailwind 上下文，并提供类名验证服务。
- **`reporter.js`**: 报告生成模块。将分析结果格式化为控制台易读的文本或结构化的 JSON 数据。
- **`parsers/`**: 针对不同文件类型的解析器集合。
  - **`css.js`**: 解析 `.css`, `.scss`, `.less` 文件，提取样式定义。
  - **`script.js`**: 解析 `.js`, `.jsx`, `.tsx` 文件，提取类名引用（支持 JSX 和 HTML-in-JS）。
  - **`vue.js`**: 解析 `.vue` 单文件组件，同时处理 `<template>`（引用）和 `<style>`（定义）。
  - **`html.js`**: 解析 `.html` 文件，提取类名引用。

---

## 2. 核心技术栈与依赖

项目基于 Node.js 环境开发，主要依赖如下：

| 类别                    | 库/工具                                   | 用途                                 |
| :---------------------- | :---------------------------------------- | :----------------------------------- |
| **运行时**              | Node.js                                   | 运行环境                             |
| **CLI**                 | `commander`                               | 命令行交互与参数解析                 |
| **文件系统**            | `fast-glob`                               | 高性能文件遍历                       |
| **AST 解析 (JS)**       | `@babel/parser`, `@babel/traverse`        | 解析 JS/TS/JSX 代码，提取类名        |
| **AST 解析 (CSS)**      | `postcss`, `postcss-scss`, `postcss-less` | 解析样式表，支持嵌套等预处理语法     |
| **AST 解析 (Vue/HTML)** | `@vue/compiler-sfc`, `@vue/compiler-dom`  | 解析 Vue 组件及 HTML 模板            |
| **Tailwind**            | `tailwindcss` (v3)                        | 提供核心引擎，用于加载配置和验证类名 |
| **工具**                | `chalk`                                   | 控制台输出着色                       |
| **工具**                | `resolve`                                 | 处理模块路径解析                     |

---

## 3. 核心功能与业务逻辑

### 3.1 CSS 类定义与引用提取

工具通过两张核心映射表（Map）来维护项目状态：

1.  **Definitions (定义)**: 记录所有样式表中定义的类。
    - 结构：`Map<ClassName, Array<{ file, line, scoped }>>`
    - 关键逻辑：区分 `scoped`（仅在当前文件有效）和 `global` 样式。
2.  **Usages (引用)**: 记录所有模板和脚本中使用的类。
    - 结构：`Map<ClassName, Array<{ file, line, confidence }>>`
    - 关键逻辑：引入 `confidence`（置信度）字段，区分明确的 `class` 属性（High）和推断的字符串（Low）。

### 3.2 双向静态检测

- **未使用的类 (Unused Definition)**:
  - 遍历 `Definitions`。
  - 若某类名在 `Usages` 中不存在，且不是 Tailwind 类，且未被忽略模式匹配，则报告未使用。
  - **Scoped 处理**：若为 Scoped 样式，仅检查同一文件内的引用。
- **未定义的类 (Undefined Reference)**:
  - 遍历 `Usages`。
  - 若某类名在 `Definitions` 中不存在，且不是 Tailwind 类，且未被忽略模式匹配，则报告未定义。
  - **置信度过滤**：仅当引用置信度为 `high` 时才报告错误（避免误报 JS 中的随机字符串）。

### 3.3 智能 Tailwind CSS 识别

- 自动检测并加载项目根目录的 `tailwind.config.js`。
- **创新特性**：支持扫描 HTML 文件中的内联配置 (`<script>tailwind.config = {...}</script>`)，适配原生开发场景。
- 使用 Tailwind 内部引擎 (`createContext`, `generateRules`) 准确判断一个类名是否由 Tailwind 生成（支持任意值 `w-[10px]` 和变体 `hover:`）。

---

## 4. 详细调用链路分析

以下是执行一次完整分析的内部流程：

1.  **启动 (Bootstrap)**
    - 用户运行命令 -> `index.js` 捕获参数 -> 实例化 `Analyzer(rootDir, options)`。

2.  **初始化 (Initialization)**
    - `Analyzer.run()` -> `Analyzer.init()` -> `createTailwindContext()`。
    - `tailwind.js` 尝试加载配置（文件或 HTML 内联），创建 Tailwind 上下文环境。

3.  **遍历 (Traversal)**
    - 调用 `traverseProject()` 获取所有目标文件列表（`.css`, `.vue`, `.js`, `.html` 等）。

4.  **解析 (Parsing)** - 并行或顺序处理每个文件：
    - **CSS/SCSS**: 调用 `parseCss` -> 使用 PostCSS 遍历 AST -> 存入 `definitions`。
    - **Vue**: 调用 `parseVue` -> 分解 SFC ->
      - `<style>` 块 -> `parseCss` -> 存入 `definitions`。
      - `<template>` 块 -> 遍历 AST 提取静态/动态 class -> 存入 `usages`。
      - `<script>` 块 -> `parseScript` -> 存入 `usages`。
    - **JS/JSX**: 调用 `parseScript` -> Babel 解析 ->
      - `JSXAttribute` (className) -> 提取 (Confidence: High)。
      - `StringLiteral` / `TemplateLiteral` -> 启发式检测 (HTML片段或类名列表) -> 提取 (Confidence: Low/High)。
    - **HTML**: 调用 `parseHtml` -> Vue DOM Compiler 解析 -> 提取 class 属性 -> 存入 `usages`。

5.  **分析 (Analysis)**
    - `Analyzer.analyze()` 对比 `definitions` 和 `usages` 集合。
    - 应用忽略规则（正则）和 Tailwind 验证（`isTailwindClass`）。
    - 生成问题列表（Issue List）。

6.  **报告 (Reporting)**
    - `reporter.js` 接收问题列表 -> 按文件分组 -> 输出带颜色的控制台文本或 JSON 文件。

---

## 5. 关键技术与实现细节

### 5.1 混合解析策略 (Hybrid Parsing)

在 `src/parsers/script.js` 中，为了平衡准确率与覆盖率，采用了混合策略：

- **AST 精确匹配**：对于 JSX 的 `className` 属性，进行精确 AST 提取，置信度设为高。
- **HTML-in-JS 检测**：检测字符串是否以 `<` 开头，若是则调用 HTML 解析器处理，支持 Web Components 的 `innerHTML` 写法。
- **贪婪匹配 (Greedy Matching)**：对于普通字符串，按空格分割并正则过滤（允许 Tailwind 特殊字符如 `[]`, `:`, `/`），作为潜在引用，置信度设为低。这确保了在 JS 中动态拼接类名时不会误报“未使用”，同时也避免了将普通文本误报为“未定义类”。

### 5.2 Tailwind 上下文深度集成

工具没有简单地使用正则匹配 Tailwind 类，而是通过 `require` 及其内部库 (`setupContextUtils`) 实例化了真正的 Tailwind 引擎。

- **优势**：能理解 `tailwind.config.js` 中的 `theme` 配置（如自定义颜色）。
- **兼容性**：针对 ESM 和 CJS 项目，实现了自动降级加载策略（`require` 失败则尝试 `import`）。

### 5.3 鲁棒的配置加载

为了支持原生 HTML 项目（无 Node.js 环境），工具在 `src/tailwind.js` 中实现了一个微型解析器，利用 `Function` 构造器安全地解析 HTML 文件中的 `tailwind.config` 对象字面量。

---

## 6. 数据流与状态管理

系统采用**集中式状态管理**模式，由 `Analyzer` 实例持有所有状态：

- **输入流**：源代码文件内容 (String)。
- **中间态**：
  - `definitions`: 全局样式注册表。
  - `usages`: 全局引用注册表。
  - `tailwindContext`: 外部规则验证器。
- **输出流**：`Issue[]` 数组 -> 格式化字符串/JSON。

数据在模块间通过显式的参数传递和返回值流动，没有使用全局变量（除配置外），保证了多次运行的隔离性（便于未来扩展为 Watch 模式或 LSP Server）。

---

## 7. 配置与外部服务集成

- **配置管理**：
  - **命令行参数**：优先级最高，用于指定运行时行为（如 `--ignore`）。
  - **项目配置**：自动读取目标项目的 `tailwind.config.js`，实现“零配置”开箱即用。
- **外部集成**：
  - **Tailwind CSS**：作为核心对等依赖（Peer Dependency）或内部依赖集成。
  - **文件系统**：直接与本地文件系统交互，无网络请求或数据库依赖。

---

## 8. 代码质量与可维护性

- **模块化设计**：每个解析器独立存在，新增文件类型支持只需添加新的 Parser 并在 `Analyzer` 中注册。
- **容错机制**：所有解析过程包裹在 `try-catch` 中，单个文件的解析失败不会导致整个分析进程崩溃，错误会被记录但不中断主流程。
- **扩展性**：
  - `analyzer.js` 中的 `addDefinition` 和 `addUsage` 方法为未来支持更多类型的样式（如 CSS Modules）预留了接口。
  - 置信度系统为未来引入 AI 辅助分析或更复杂的流分析打下了基础。
- **规范性**：代码遵循 Node.js 异步编程最佳实践（`async/await`），大量使用 `Promise` 并行处理（尽管目前为了逻辑清晰部分流程串行化，但架构支持并行）。

---

这份总结展示了一个成熟、针对性强且具备良好扩展性的前端静态分析工具架构，特别是在处理现代前端复杂的混合技术栈（Vue + Tailwind + 原生 HTML/JS）方面表现出色。
