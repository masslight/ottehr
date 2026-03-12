import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_NDC,
  getSecret,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-update-in-house-medication',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { medicationID, status, name, ndc, medispanID, secrets } = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('Created Oystehr client');

      const response = await performEffect(oystehr, medicationID, name, ndc, medispanID, status);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-update-in-house-medication', error, ENVIRONMENT);
    }
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  medicationID: string,
  name?: string,
  ndc?: string,
  medispanID?: string,
  status?: string
): Promise<Medication> => {
  const medication = await oystehr.fhir.get<Medication>({
    resourceType: 'Medication',
    id: medicationID,
  });
  if (!medication) {
    throw new Error(`Medication ID ${medicationID} not found`);
  }
  const patchOperations: Operation[] = [];

  const medicationName =
    medication?.identifier?.find((identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)?.value || '';

  if (name !== undefined && name !== medicationName) {
    const medicationNameIndex = medication.identifier?.findIndex(
      (identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
    );
    patchOperations.push({
      op: 'replace',
      path: `/identifier/${medicationNameIndex}/value`,
      value: name,
    });
  }
  const medicationNDC = medication?.code?.coding?.find((coding) => coding.system === CODE_SYSTEM_NDC)?.code || '';
  if (ndc !== undefined && ndc !== medicationNDC) {
    const ndcIndex = medication.code?.coding?.findIndex((coding) => coding.system === CODE_SYSTEM_NDC);
    if (ndcIndex !== undefined && ndcIndex >= 0) {
      patchOperations.push({
        op: 'replace',
        path: `/code/coding/${ndcIndex}/code`,
        value: ndc,
      });
    } else {
      patchOperations.push({
        op: 'add',
        path: '/code/coding/-',
        value: {
          system: CODE_SYSTEM_NDC,
          code: ndc,
        },
      });
    }
  }
  const medicationMedispanID =
    medication?.code?.coding?.find((coding) => coding.system === MEDICATION_DISPENSABLE_DRUG_ID)?.code || '';
  if (medispanID !== undefined && medispanID !== medicationMedispanID) {
    const medispanIDIndex = medication.code?.coding?.findIndex(
      (coding) => coding.system === MEDICATION_DISPENSABLE_DRUG_ID
    );
    if (medispanIDIndex !== undefined && medispanIDIndex >= 0) {
      patchOperations.push({
        op: 'replace',
        path: `/code/coding/${medispanIDIndex}/code`,
        value: medispanID,
      });
    } else {
      patchOperations.push({
        op: 'add',
        path: '/code/coding/-',
        value: {
          system: MEDICATION_DISPENSABLE_DRUG_ID,
          code: medispanID,
        },
      });
    }
  }

  const medicationStatus = medication.status;

  if (status !== undefined && status !== medicationStatus) {
    patchOperations.push({
      op: medication.status ? 'replace' : 'add',
      path: '/status',
      value: status,
    });
  }

  if (patchOperations.length > 0) {
    return await oystehr.fhir.patch<Medication>({
      resourceType: 'Medication',
      id: medicationID,
      operations: patchOperations,
    });
  }
  return medication;
};
