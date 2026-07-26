export type InventoryFile = {
  name: string;
  relativePath: string;
  size: number;
  lastModified: number;
};

export type FilenameDateCandidate = {
  date: string;
  raw: string;
  source: "filename" | "folder";
  contextHint:
    | "execution"
    | "plan"
    | "deadline"
    | "written"
    | "reference"
    | "unknown";
  confidence: "high" | "medium";
};

export type AnalyzedFilename = InventoryFile & {
  extension: string;
  analysisTitle: string;
  dateCandidates: FilenameDateCandidate[];
  periods: string[];
  statusPeriod: string;
  versionTags: string[];
  role: string;
  roleLabel: string;
  roleScore: number;
  roleConfidence: "높음" | "보통" | "낮음";
  roleReasons: string[];
  roleAlternatives: Array<{ role: string; label: string; score: number }>;
  lifecycleStage:
    | "terminal"
    | "active"
    | "planned"
    | "continuous"
    | "reference"
    | "conflict"
    | "unknown";
  lifecycleLabel: string;
  lifecycleReasons: string[];
  branchLabel: string;
  branchSource: string;
  branchScore: number;
  branchConfidence: "높음" | "보통" | "낮음";
  branchReasons: string[];
  duplicateGroupSize: number;
  finalCandidateConflict: boolean;
  evidenceRepresentative: boolean;
};

export type HandoverBranch = {
  id: string;
  label: string;
  fileCount: number;
  evidenceFileCount: number;
  duplicateCount: number;
  multipleFinalGroups: number;
  mode: string;
  modeLabel: string;
  modeScore: number;
  modeEvidence: string;
  statusCode: string;
  statusLabel: string;
  statusEvidence: string;
  statusScore: number;
  statusConfidence: "높음" | "보통" | "낮음";
  focusPeriod: string;
  statusBasisFileCount: number;
  historicalStatuses: Array<{
    period: string;
    code: string;
    evidence: string;
    score: number;
  }>;
  classificationScore: number;
  classificationConfidence: "높음" | "보통" | "낮음";
  classificationReasons: string[];
  versionCaution: string;
  periods: string[];
  roleCounts: Record<string, number>;
  latestTimestamp: number;
  latestLabel: string;
  sourceCounts: Record<string, number>;
  files: AnalyzedFilename[];
  caution: string;
};

export type FilenameAnalysis = {
  version: number;
  basis: "folder-and-filename-only";
  engine: {
    id: "weighted-filename-v2";
    label: string;
    targetProfile: string;
    method: string;
  };
  rootName: string;
  analyzedAt: string;
  fileCount: number;
  folderCount: number;
  totalSize: number;
  branches: HandoverBranch[];
  statusCounts: Record<string, number>;
  branchConfidenceCounts: Record<string, number>;
  roleConfidenceCounts: Record<string, number>;
  reviewRequiredCount: number;
  duplicateCount: number;
  unclassifiedCount: number;
  limitations: string[];
};

export function analyzeFilenameInventory(
  inventory: InventoryFile[],
): FilenameAnalysis;

export function buildFilenameHandoverMarkdown(
  analysis: FilenameAnalysis,
  aiDraft?: string,
): string;

export const analyzerLabels: {
  roles: Record<string, string>;
  modes: Record<string, string>;
  statuses: Record<string, string>;
  lifecycle: Record<string, string>;
};
