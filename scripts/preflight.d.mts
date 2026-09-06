export interface SyntaxErrorItem {
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
}

export interface SyntaxCheckResult {
  readonly passed: boolean;
  readonly checkedCount: number;
  readonly errors: readonly SyntaxErrorItem[];
}

export interface PreflightBenchmarkResult {
  readonly minMs: number;
  readonly maxMs: number;
  readonly avgMs: number;
  readonly p95Ms: number;
}

export function getChangedTsFiles(cwd?: string, baseRef?: string): string[];
export function checkSyntaxDiagnostics(filePaths: readonly string[]): SyntaxCheckResult;
export function benchmarkPreflight(
  filePaths: readonly string[],
  iterations?: number
): PreflightBenchmarkResult;
