import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartSectionRequest } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const encounterId = z.string().uuid();

// Strict on purpose: the request names a section and, for two sections, a small enumerated option; the
// FHIR searches behind a section are the server's and never come from the caller.
const GetChartSectionSchema = z.discriminatedUnion('section', [
  z.object({ encounterId, section: z.literal('encounterNotes') }).strict(),
  z
    .object({
      encounterId,
      section: z.literal('history'),
      params: z
        .object({ medicationCount: z.number().int().min(1).max(1000).optional() })
        .strict()
        .optional(),
    })
    .strict(),
  z.object({ encounterId, section: z.literal('screening') }).strict(),
  z.object({ encounterId, section: z.literal('exam') }).strict(),
  z.object({ encounterId, section: z.literal('assessment') }).strict(),
  z.object({ encounterId, section: z.literal('plan') }).strict(),
  z
    .object({
      encounterId,
      section: z.literal('notes'),
      params: z.object({ types: z.array(z.nativeEnum(NOTE_TYPE)).min(1) }).strict(),
    })
    .strict(),
  z.object({ encounterId, section: z.literal('aiChat') }).strict(),
]);

export function validateRequestParameters(input: ZambdaInput): GetChartSectionRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const request = safeValidate(GetChartSectionSchema, safeJsonParse(input.body));
  return { ...(request as GetChartSectionRequest), secrets: input.secrets };
}
