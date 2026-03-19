import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, Extension } from 'fhir/r4b';
import { CHARGE_MASTER_DESIGNATION_EXTENSION_URL, getSecret, PRIVATE_EXTENSION_BASE_URL, SecretsKeys } from 'utils';
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
  'designate-charge-master',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { feeScheduleId, designation, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      // Find all fee schedule ChargeItemDefinitions with the rcm tag
      const allFeeSchedules = await oystehr.fhir.search<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        params: [
          {
            name: '_tag',
            value: `${PRIVATE_EXTENSION_BASE_URL}/rcm|rcm`,
          },
        ],
      });

      const feeSchedules = allFeeSchedules.unbundle();

      // Remove the designation extension from all fee schedules that currently have it
      for (const fs of feeSchedules) {
        if (!fs.id) continue;

        const hasDesignation = fs.extension?.some(
          (ext) => ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL && ext.valueCode === designation
        );

        if (hasDesignation) {
          const updatedExtensions = (fs.extension || []).filter(
            (ext) => !(ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL && ext.valueCode === designation)
          );

          await oystehr.fhir.update<ChargeItemDefinition>({
            ...fs,
            extension: updatedExtensions.length > 0 ? updatedExtensions : undefined,
          });
        }
      }

      // Set the designation on the target fee schedule
      const target = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: feeScheduleId,
      });

      const existingExtensions: Extension[] = (target.extension || []).filter(
        (ext) => ext.url !== CHARGE_MASTER_DESIGNATION_EXTENSION_URL
      );

      existingExtensions.push({
        url: CHARGE_MASTER_DESIGNATION_EXTENSION_URL,
        valueCode: designation,
      });

      const updated = await oystehr.fhir.update<ChargeItemDefinition>({
        ...target,
        extension: existingExtensions,
      });

      return {
        statusCode: 200,
        body: JSON.stringify(updated),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('designate-charge-master', error, ENVIRONMENT);
    }
  }
);
