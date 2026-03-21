import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, Extension } from 'fhir/r4b';
import { CHARGE_MASTER_DESIGNATION_EXTENSION_URL, getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  RCM_TAG_SYSTEM,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler(
  'designate-charge-master-entry',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { chargeMasterId, designation, secrets } = validateRequestParameters(input);

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      // Find all charge master ChargeItemDefinitions with the charge-master tag
      const allChargeMasters = await oystehr.fhir.search<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        params: [
          {
            name: '_tag',
            value: `${RCM_TAG_SYSTEM}|charge-master`,
          },
        ],
      });

      const chargeMasters = allChargeMasters.unbundle();

      // Remove the designation extension from all charge masters that currently have it
      for (const cm of chargeMasters) {
        if (!cm.id) continue;

        const hasDesignation = cm.extension?.some(
          (ext) => ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL && ext.valueCode === designation
        );

        if (hasDesignation) {
          const updatedExtensions = (cm.extension || []).filter(
            (ext) => !(ext.url === CHARGE_MASTER_DESIGNATION_EXTENSION_URL && ext.valueCode === designation)
          );

          await oystehr.fhir.update<ChargeItemDefinition>({
            ...cm,
            extension: updatedExtensions.length > 0 ? updatedExtensions : undefined,
          });
        }
      }

      // Set the designation on the target charge master
      const target = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: chargeMasterId,
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
      return topLevelCatch('designate-charge-master-entry', error, ENVIRONMENT);
    }
  }
);
