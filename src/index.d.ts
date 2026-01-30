export interface AnalyzerOptions {
  ignorePatterns?: string[];
}

export interface Issue {
  type: 'unused' | 'undefined';
  file: string;
  className: string;
  line: number;
}

export class Analyzer {
  constructor(rootDir: string, options?: AnalyzerOptions);
  run(): Promise<Issue[]>;
}

export function formatReport(issues: Issue[], rootDir: string, format?: 'console' | 'json'): string;
