import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_HCPCS,
  CODE_SYSTEM_NDC,
  getMedicationName,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  UpdateInHouseMedicationInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  omitFalsyValues,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-update-in-house-medication',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { medicationID, status, name, ndc, medispanID, medispanIDForInteractions, cptCodes, hcpcsCodes, secrets } =
      validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, {
      medicationID,
      name,
      ndc,
      medispanID,
      medispanIDForInteractions,
      cptCodes,
      hcpcsCodes,
      status,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  updateDetail: UpdateInHouseMedicationInput
): Promise<Medication> => {
  const { medicationID, name, ndc, medispanID, medispanIDForInteractions, cptCodes, hcpcsCodes, status } = updateDetail;
  const medication = await oystehr.fhir.get<Medication>({
    resourceType: 'Medication',
    id: medicationID,
  });
  if (!medication) {
    throw new Error(`Medication ID ${medicationID} not found`);
  }
  const patchOperations: Operation[] = [];

  const medicationName = getMedicationName(medication) || '';

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
  const existingCodings = medication.code?.coding ?? [];
  const existingNdc = existingCodings.find((c) => c.system === CODE_SYSTEM_NDC)?.code ?? '';
  const existingMedispanID = existingCodings.find((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID)?.code ?? '';
  const existingMedispanIDForInteractions =
    existingCodings.find((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS)?.code ?? '';

  const ndcChanged = ndc !== undefined && ndc !== existingNdc;
  const medispanChanged = medispanID !== undefined && medispanID !== existingMedispanID;
  const medispanForInteractionsChanged =
    medispanIDForInteractions !== undefined && medispanIDForInteractions !== existingMedispanIDForInteractions;
  const codesChanged = cptCodes !== undefined || hcpcsCodes !== undefined;

  // Rebuild /code/coding as a single op so we don't rely on /code or /code/coding
  // already existing on the resource (append-style ops fail otherwise).
  if (ndcChanged || medispanChanged || medispanForInteractionsChanged || codesChanged) {
    const otherCodings = existingCodings.filter(
      (c) =>
        c.system !== CODE_SYSTEM_NDC &&
        c.system !== MEDICATION_DISPENSABLE_DRUG_ID &&
        c.system !== CODE_SYSTEM_CPT &&
        c.system !== CODE_SYSTEM_HCPCS
    );
    const hadNdc = existingCodings.some((c) => c.system === CODE_SYSTEM_NDC);
    const hadMedispan = existingCodings.some((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID);
    const hadMedispanForInteractions = existingCodings.some(
      (c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS
    );
    const resolvedNdcCoding =
      ndcChanged || hadNdc ? [{ system: CODE_SYSTEM_NDC, code: ndcChanged ? ndc! : existingNdc }] : [];
    const resolvedMedispanCoding =
      medispanChanged || hadMedispan
        ? [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: medispanChanged ? medispanID! : existingMedispanID }]
        : [];
    const resolvedMedispanForInteractionsCoding =
      medispanForInteractionsChanged || hadMedispanForInteractions
        ? [
            {
              system: MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
              code: medispanForInteractionsChanged ? medispanIDForInteractions! : existingMedispanIDForInteractions,
            },
          ]
        : [];
    const resolvedCptCodings = (
      cptCodes ??
      existingCodings
        .filter((c) => c.system === CODE_SYSTEM_CPT)
        .map((c) => ({ code: c.code!, ...omitFalsyValues({ display: c.display }) }))
    ).map(({ code, display }) => ({
      system: CODE_SYSTEM_CPT,
      code,
      ...omitFalsyValues({ display }),
    }));
    const resolvedHcpcsCodings = (
      hcpcsCodes ??
      existingCodings
        .filter((c) => c.system === CODE_SYSTEM_HCPCS)
        .map((c) => ({ code: c.code!, ...omitFalsyValues({ display: c.display }) }))
    ).map(({ code, display }) => ({
      system: CODE_SYSTEM_HCPCS,
      code,
      ...omitFalsyValues({ display }),
    }));
    const newCoding = [
      ...otherCodings,
      ...resolvedNdcCoding,
      ...resolvedMedispanCoding,
      ...resolvedMedispanForInteractionsCoding,
      ...resolvedCptCodings,
      ...resolvedHcpcsCodings,
    ];
    if (medication.code === undefined) {
      patchOperations.push({ op: 'add', path: '/code', value: { coding: newCoding } });
    } else if (medication.code.coding === undefined) {
      patchOperations.push({ op: 'add', path: '/code/coding', value: newCoding });
    } else if (newCoding.length > 0) {
      patchOperations.push({ op: 'replace', path: '/code/coding', value: newCoding });
    } else {
      patchOperations.push({ op: 'remove', path: '/code/coding' });
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
