import { APIGatewayProxyResult } from 'aws-lambda';
import { billingCodePrompt, billingCodesSchema, parseAiSuggestions } from 'utils/lib/procedure-coding/ai';
import { detectProcedureFamily, suggestCode } from 'utils/lib/procedure-coding/evaluate';
import { ProcedureFactsInput } from 'utils/lib/procedure-coding/model.types';
import { isStructuredFacts, StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { z } from 'zod';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

const schema = z.object({
  procedureType: z.string().min(1).max(500),
  structuredFacts: z.custom<StructuredFacts>(isStructuredFacts).optional(),
  bodySite: z.string().optional(),
  otherBodySite: z.string().optional(),
  bodySide: z.string().optional(),
  technique: z.array(z.string()).optional(),
  suppliesUsed: z.array(z.string()).optional(),
  otherSuppliesUsed: z.string().optional(),
  medicationUsed: z.string().optional(),
  procedureDetails: z.string().optional(),
  timeSpent: z.string().optional(),
  diagnoses: z.array(z.object({ code: z.string(), display: z.string() })).optional(),
  lengthCm: z.number().optional(),
  repairDepth: z
    .enum([
      'superficial-single',
      'subcutaneous-single',
      'subcutaneous-layered',
      'fascia-muscle-layered',
      'tissue-adhesive-only',
      'strips-only',
    ])
    .optional(),
  infusionStartTime: z.string().optional(),
  infusionStopTime: z.string().optional(),
  specimenSent: z.boolean().optional(),
});

export const index = wrapHandler(
  'recommend-billing-codes',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    let body: unknown;

    try {
      body = JSON.parse(input.body || '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid procedure data' }) };
    }

    const parsed = schema.safeParse(body);

    if (!parsed.success) return { statusCode: 400, body: JSON.stringify({ message: 'Invalid procedure data' }) };

    const facts: ProcedureFactsInput = parsed.data;

    // Enforce the exact-name boundary on the server too. Missing answers in a known family never call AI.
    const evaluation = detectProcedureFamily(facts)
      ? suggestCode(facts)
      : parseAiSuggestions(
          // One in-flight generation per recommendation. Retry only after a transient failure.
          await invokeChatbotVertexAI(
            [{ text: billingCodePrompt(facts) }],
            input.secrets,
            billingCodesSchema,
            undefined,
            {
              retryMode: 'sequential',
            }
          )
        );

    return { statusCode: 200, body: JSON.stringify(evaluation) };
  }
);
