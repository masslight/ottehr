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

    // Store case rate amount if provided
    if (caseRateAmount !== undefined) {
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

    const updated = await oystehr.fhir.update<ChargeItemDefinition>({
      ...existing,
      meta: { ...existing.meta, tag: tags },
      title: name,
      date: effectiveDate || existing.date,
      description: description || undefined,
      status: status ?? existing.status,
      propertyGroup,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(updated),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('update-fee-schedule', error, ENVIRONMENT);
  }
});
