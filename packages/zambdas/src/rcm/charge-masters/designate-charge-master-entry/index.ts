import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, Coding } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
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

      // Set the designation tag on the target charge master and clear useContext
      const target = await oystehr.fhir.get<ChargeItemDefinition>({
        resourceType: 'ChargeItemDefinition',
        id: chargeMasterId,
      });

      // Remove any existing designation tags (default-insurance or self-pay) and add the new one
      const baseTags: Coding[] = (target.meta?.tag || []).filter(
        (t) => !(t.system === RCM_TAG_SYSTEM && (t.code === 'default-insurance' || t.code === 'self-pay'))
      );
      baseTags.push({ system: RCM_TAG_SYSTEM, code: designation });

      const updated = await oystehr.fhir.update<ChargeItemDefinition>({
        ...target,
        meta: { ...target.meta, tag: baseTags },
        useContext: undefined,
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
