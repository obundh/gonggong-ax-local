import type { FilenameAnalysis } from "./filename-analyzer.mjs";

export type LocalModelCandidate = {
  id: string;
  family: string;
  parameterSize: string;
  digest?: string;
  sizeBytes?: number;
  quantization?: string;
};

export type RankedLocalModel = LocalModelCandidate & {
  score: number;
  baselineCompatible: boolean;
  tier: "e2b" | "e4b" | "small-fallback" | "manual-only";
  reason: string;
};

export type LocalModelScore = Pick<
  RankedLocalModel,
  "score" | "baselineCompatible" | "tier" | "reason"
>;

export type PackedAiContext = {
  text: string;
  includedBranches: number;
  totalBranches: number;
  omittedBranches: number;
  estimatedTokens: number;
  tokenBudget: number;
  partial: boolean;
};

export const AI_DATA_TOKEN_BUDGET: 1800;
export const BASELINE_OLLAMA_OPTIONS: Readonly<{
  temperature: 0.1;
  num_ctx: 4096;
  num_predict: 700;
}>;

export function scoreLocalModel(model: LocalModelCandidate): LocalModelScore;
export function rankLocalModels(
  models: LocalModelCandidate[],
): RankedLocalModel[];
export function estimateConservativeTokens(value: unknown): number;
export function packCompactAiContext(
  analysis: FilenameAnalysis,
  scheduleOverrides?: Record<string, { date: string }>,
  tokenBudget?: number,
): PackedAiContext;
export function buildCompactAiContext(
  analysis: FilenameAnalysis,
  scheduleOverrides?: Record<string, { date: string }>,
  tokenBudget?: number,
): string;
