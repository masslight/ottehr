import Oystehr from '@oystehr/sdk';
import { QueryClient } from '@tanstack/react-query';
import { AdHocLayer, AdHocRow, LlmDatasetSchema } from 'utils';

export type { AdHocRow };

// An opt-in data layer (checkbox on the page); selected layers are passed to fetch + buildSchema.
export type AdHocDatasetOption = AdHocLayer;

export interface FetchContext {
  oystehrZambda: Oystehr;
  // Window fetches go through queryClient.fetchQuery so identical requests are deduped/cached (no
  // duplicate zambda calls from StrictMode re-runs or re-renders).
  queryClient: QueryClient;
  dateRange: { start: string; end: string };
  options?: Record<string, boolean>;
}

// A selectable data source. New sources register here with their own fetch + schema; nothing else changes.
export interface AdHocDataset {
  id: string;
  label: string;
  description: string;
  options?: AdHocDatasetOption[];
  fetch: (ctx: FetchContext) => Promise<AdHocRow[]>;
  buildSchema: (rows: AdHocRow[], options?: Record<string, boolean>) => LlmDatasetSchema;
}
