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
  versionTags: string[];
  role: string;
  roleLabel: string;
  branchLabel: string;
  branchSource: string;
};

export type HandoverBranch = {
  id: string;
  label: string;
  fileCount: number;
  mode: string;
  modeLabel: string;
  statusCode: string;
  statusLabel: string;
  statusEvidence: string;
  classificationConfidence: "높음" | "보통" | "낮음";
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
  rootName: string;
  analyzedAt: string;
  fileCount: number;
  folderCount: number;
  totalSize: number;
  branches: HandoverBranch[];
  statusCounts: Record<string, number>;
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
};
