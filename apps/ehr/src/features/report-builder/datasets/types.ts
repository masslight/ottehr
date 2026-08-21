import Oystehr from '@oystehr/sdk';
import { QueryClient } from '@tanstack/react-query';
import { AdHocLayerMap } from 'utils/lib/types/adhoc/datasets/dataset';
import { AdHocRow, LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { AdHocLayer } from 'utils/lib/types/adhoc/query/layers';
import { z } from 'zod';

export type { AdHocRow };

export interface FetchContext {
  oystehrZambda: Oystehr;
  queryClient: QueryClient;
  dateRange: { start: string; end: string };
  options?: Record<string, boolean>;
}

// A selectable data source. New sources register here with their own fetch + schema; nothing else changes.
export interface AdHocDataset {
  id: string;
  label: string;
  description: string;
  options?: AdHocLayer[];
  layers?: AdHocLayerMap;
  baseSchema?: z.ZodObject<z.ZodRawShape>;
  internalFields?: readonly string[];
  fetch: (ctx: FetchContext) => Promise<AdHocRow[]>;
  buildSchema: (rows: AdHocRow[], options?: Record<string, boolean>) => LlmDatasetSchema;
}
