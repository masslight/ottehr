// Pre-fetch classifier: which opt-in layers a request needs. Non-fatal (generate's needsLayers backfills).
import { z } from 'zod';

export const InferAdHocLayersInputSchema = z.object({
  datasetId: z.string().min(1),
  layers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })
  ),
  request: z.string().min(1),
});
export type InferAdHocLayersInput = z.infer<typeof InferAdHocLayersInputSchema>;

export const InferAdHocLayersOutputSchema = z.object({
  layerIds: z.array(z.string()),
});
export type InferAdHocLayersOutput = z.infer<typeof InferAdHocLayersOutputSchema>;
