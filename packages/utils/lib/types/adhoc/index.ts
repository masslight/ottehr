// Shared ad-hoc report types, organized by the same domains as the app feature slice. One Zod
// schema per data endpoint response is the single source of truth: it derives the TS types,
// validates the endpoint response, and serializes the LLM-facing schema for the prompt.
// datasets   — Zod row/I-O schemas per dataset + the LLM schema serialization
// query      — opt-in depth (layers) + time-window selector
// generation — the generate / infer endpoint contracts
// sandbox    — the iframe ↔ SPA message contract (whitelisted events)
// saved      — persisted report definition + CRUD I/O
export * from './datasets/llm-schema';
export * from './datasets/dataset';
export * from './sandbox/events';
export * from './datasets/encounters';
export * from './datasets/patients';
export * from './datasets/billing';
export * from './query/layers';
export * from './query/date-range';
export * from './generation/generate.types';
export * from './generation/infer.types';
export * from './generation/runtime-scope';
export * from './generation/transpile';
export * from './saved/saved.types';
