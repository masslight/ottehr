export const MODEL_IDS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'] as const;
export type ModelId = (typeof MODEL_IDS)[number];
export const DEFAULT_MODEL: ModelId = 'claude-opus-5-5';

export const MODEL_LABELS: Record<ModelId, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
  'claude-fable-5-1': 'Claude Fable 5.1',
};

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

/** The server-side refusal fallback is offered for these; Haiku has none. */
export const supportsFallback = (model: ModelId): boolean => model !== 'claude-haiku-5-5';

export const MAX_TOKENS = 64000;
