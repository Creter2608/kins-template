export type AntiGamingViolationCode =
  | 'FORBIDDEN_FILE_MODIFIED'
  | 'ASSERTION_COMMENTED_OUT'
  | 'ASSERTION_REMOVED'
  | 'ASSERTION_SWALLOWED'
  | 'MOCK_EVASION';

export interface AntiGamingViolation {
  readonly code: AntiGamingViolationCode;
  readonly path: string;
  readonly line?: number | undefined;
  readonly message: string;
}

export interface AntiGamingOptions {
  readonly maxViolations?: number;
}

export interface AntiGamingResult {
  readonly clean: boolean;
  readonly violations: readonly AntiGamingViolation[];
}

export function validateGitDiffIntegrity(
  repoRoot: string,
  baseCommit: string,
  options?: AntiGamingOptions
): Promise<AntiGamingResult>;
