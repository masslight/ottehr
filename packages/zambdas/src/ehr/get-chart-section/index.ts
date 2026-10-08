import { APIGatewayProxyResult } from 'aws-lambda';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartSectionRequest, GetChartSectionResponse } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { buildChartSection } from '../../shared/chart-sections/registry';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

const encounterIdSchema = z.string().uuid();

// Strict: a request is an encounter id, a section name and, for history and notes, that section's option
// object. Any other key is rejected.
export const GetChartSectionSchema: z.ZodType<GetChartSectionRequest> = z.discriminatedUnion('section', [
  z.object({ encounterId: encounterIdSchema, section: z.literal('encounterNotes') }).strict(),
  z
    .object({
      encounterId: encounterIdSchema,
      section: z.literal('history'),
      params: z
        .object({ medicationCount: z.number().int().min(1).max(1000).optional() })
        .strict()
        .optional(),
    })
    .strict(),
  z.object({ encounterId: encounterIdSchema, section: z.literal('screening') }).strict(),
  z.object({ encounterId: encounterIdSchema, section: z.literal('exam') }).strict(),
  z.object({ encounterId: encounterIdSchema, section: z.literal('assessment') }).strict(),
  z.object({ encounterId: encounterIdSchema, section: z.literal('plan') }).strict(),
  z
    .object({
      encounterId: encounterIdSchema,
      section: z.literal('notes'),
      params: z.object({ types: z.array(z.nativeEnum(NOTE_TYPE)).min(1) }).strict(),
    })
    .strict(),
  z.object({ encounterId: encounterIdSchema, section: z.literal('aiChat') }).strict(),
]);

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
const ZAMBDA_NAME = 'get-chart-section';

/**
 * Reads one section of a visit's chart. The section names a fixed set of fields whose FHIR searches live
 * on the server (shared/chart-sections); the caller supplies the encounter and the section name only.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  const { secrets, encounterId, section, params } = validateWithSchema(GetChartSectionSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const data = await buildChartSection({ oystehr, m2mToken }, encounterId, section, params);
  const response: GetChartSectionResponse = { section, data };

  return {
    body: JSON.stringify(response),
    statusCode: 200,
  };
});
