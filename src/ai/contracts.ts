import { Workspace } from "@/domain/models";
export interface IntelligenceResult<T> {
  value: T;
  sourceIds: string[];
  confidence: number;
  requiresReview: boolean;
}
export interface IntelligenceService {
  brief(workspace: Workspace): Promise<IntelligenceResult<string>>;
  extract(sourceText: string): Promise<IntelligenceResult<Partial<Workspace>>>;
  search(query: string): Promise<IntelligenceResult<string>>;
}
// No live AI provider in V1. Search uses the local workspace and never fabricates answers.
