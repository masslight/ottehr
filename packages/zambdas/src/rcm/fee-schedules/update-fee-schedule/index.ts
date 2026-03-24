import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { CASE_RATE_CODE, getSecret, RCM_TAG_SYSTEM, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('update-fee-schedule', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { id, name, effectiveDate, description, status, designation, caseRateAmount, caseRateComment, secrets } =
      validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id,
    });

    let tags = existing.meta?.tag ?? [];
    let propertyGroup = existing.propertyGroup;

    if (designation === 'case-rate') {
      // Add case-rate tag if not already present
      if (!tags.some((t) => t.system === RCM_TAG_SYSTEM && t.code === CASE_RATE_CODE)) {
        tags = [...tags, { system: RCM_TAG_SYSTEM, code: CASE_RATE_CODE }];
      }
      // Clear all procedure codes; case rate data is set separately below
      propertyGroup = undefined;
    } else if (designation === null) {
      // Remove case-rate tag
      tags = tags.filter((t) => !(t.system === RCM_TAG_SYSTEM && t.code === CASE_RATE_CODE));
      // Clear case rate data
      propertyGroup = undefined;
    }

    // Store case rate amount if provided (only when designation is explicitly case-rate)
    if (caseRateAmount !== undefined && designation === 'case-rate') {
      propertyGroup = [
        {
          priceComponent: [
            {
              type: 'base',
              code: {
                coding: [{ code: CASE_RATE_CODE, display: 'Case Rate' }],
                ...(caseRateComment ? { text: caseRateComment } : {}),
              },
              amount: { value: caseRateAmount, currency: 'USD' },
            },
          ],
        },
      ];
    }

    await oystehr.fhir.update<ChargeItemDefinition>({
      ...existing,
      meta: { ...existing.meta, tag: tags },
      title: name,
      date: effectiveDate || existing.date,
      status: status ?? existing.status,
      propertyGroup,
    });

    // Handle description separately via PATCH to avoid FHIR empty-string rejection
    if (description) {
      const op = existing.description ? 'replace' : 'add';
      await oystehr.fhir.patch<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id,
        operations: [{ op, path: '/description', value: description }],
      });
    } else if (existing.description) {
      await oystehr.fhir.patch<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id,
        operations: [{ op: 'remove', path: '/description' }],
      });
    }

    // Re-fetch to return the final state
    const final = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(final),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('update-fee-schedule', error, ENVIRONMENT);
  }
});
