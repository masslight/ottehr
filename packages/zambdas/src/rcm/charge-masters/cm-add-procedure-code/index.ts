import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, ChargeItemDefinitionPropertyGroup, Extension } from 'fhir/r4b';
import { CPT_CODE_SYSTEM, CPT_MODIFIER_EXTENSION_URL, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'cm-add-procedure-code',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { chargeMasterId, code, description, modifier, amount, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const existing = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: chargeMasterId,
      });

      // Check for duplicate code+modifier
      const existingKey = (pg: ChargeItemDefinitionPropertyGroup): string => {
        const pc = pg.priceComponent?.[0];
        const c = pc?.code?.coding?.find((coding) => coding.system === CPT_CODE_SYSTEM)?.code || '';
        const m = pc?.extension?.find((e) => e.url === CPT_MODIFIER_EXTENSION_URL)?.valueCode || '';
        return m ? `${c}|${m}` : c;
      };
      const newKey = modifier ? `${code}|${modifier}` : code;
      const hasDuplicate = (existing.propertyGroup || []).some((pg) => existingKey(pg) === newKey);
      if (hasDuplicate) {
        return {
          statusCode: 409,
          body: JSON.stringify({
            message: `A procedure code with code ${code}${modifier ? ` / modifier ${modifier}` : ''} already exists.`,
          }),
        };
      }

      const extensions: Extension[] = [];
      if (modifier) {
        extensions.push({
          url: CPT_MODIFIER_EXTENSION_URL,
          valueCode: modifier,
        });
      }

      const newPropertyGroup: ChargeItemDefinitionPropertyGroup = {
        priceComponent: [
          {
            type: 'base',
            code: {
              coding: [{ system: CPT_CODE_SYSTEM, code, ...(description ? { display: description } : {}) }],
            },
            amount: {
              value: amount,
              currency: 'USD',
            },
            ...(extensions.length > 0 ? { extension: extensions } : {}),
          },
        ],
      };

      const updated = await oystehr.fhir.update<ChargeItemDefinition>(
        {
          ...existing,
          propertyGroup: [...(existing.propertyGroup || []), newPropertyGroup],
        },
        { optimisticLockingVersionId: existing.meta?.versionId }
      );

      return {
        statusCode: 200,
        body: JSON.stringify(updated),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('cm-add-procedure-code', error, ENVIRONMENT);
    }
  }
);
