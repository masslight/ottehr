import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { InHouseMedicationQuickPick } from 'config-types';
import { ActivityDefinition, Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_NDC,
  getSecret,
  IN_HOUSE_MEDICATION_QUICK_PICK_SEARCH,
  MEDICATION_DISPENSABLE_DRUG_ID,
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
  'admin-in-house-medications-quick-picks',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { secrets } = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('Created Oystehr client');

      const response = await performEffect(oystehr);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-in-house-medications-quick-picks', error, ENVIRONMENT);
    }
  }
);

export const performEffect = async (oystehr: Oystehr): Promise<InHouseMedicationQuickPick[]> => {
  const quickPickSearch = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: '_tag',
          value: IN_HOUSE_MEDICATION_QUICK_PICK_SEARCH,
        },
      ],
    })
  ).unbundle();
  const medicationIds = quickPickSearch.map((quickPick) => quickPick.productReference?.reference);
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        {
          name: '_id',
          value: medicationIds.map((medicationId) => medicationId?.split('/')[1]).join(','),
        },
      ],
    })
  ).unbundle();
  const quickPicks: InHouseMedicationQuickPick[] = quickPickSearch.map((quickPick) => {
    const medication = medications.find(
      (medication) => `Medication/${medication.id}` === quickPick.productReference?.reference
    );
    return {
      id: quickPick.id,
      status: quickPick.status === 'draft' ? 'inactive' : quickPick.status,
      name: quickPick.title || 'Unknown',
      medispanId: medication?.code?.coding?.find((coding) => coding.system === MEDICATION_DISPENSABLE_DRUG_ID)?.code,
      ndc: medication?.code?.coding?.find((coding) => coding.system === CODE_SYSTEM_NDC)?.code,
      dose: quickPick.dosage?.[0].doseAndRate?.[0]?.doseQuantity?.value,
      units: quickPick.dosage?.[0].doseAndRate?.[0]?.doseQuantity?.unit,
      route: quickPick.dosage?.[0].route?.coding?.[0]?.code,
      routeName: quickPick.dosage?.[0].route?.coding?.[0]?.display,
      instructions: quickPick.dosage?.[0].patientInstruction,
    };
  });
  return quickPicks;
};
