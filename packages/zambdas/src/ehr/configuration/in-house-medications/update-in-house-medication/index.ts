import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Medication } from 'fhir/r4b';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import {
  getMedicationInventoryConfig,
  makeMedicationInventoryExtension,
  MEDICATION_INVENTORY_EXTENSION_URL,
} from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { UpdateInHouseMedicationInput } from 'utils/lib/types/api/config/in-house-medications';
import {
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { ADMIN_TIER_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-update-in-house-medication',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { medicationID, status, name, ndc, medispanID, medispanIDForInteractions, inventory, secrets } =
      validateRequestParameters(input);

    // Catalog edits (name, codes, status, inventory setup) are admin-tier.
    await requireUserWithRole(getUserToken(input), secrets, ADMIN_TIER_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, {
      medicationID,
      name,
      ndc,
      medispanID,
      medispanIDForInteractions,
      inventory,
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
  const { medicationID, name, ndc, medispanID, medispanIDForInteractions, inventory, status } = updateDetail;
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

  // Rebuild /code/coding as a single op so we don't rely on /code or /code/coding
  // already existing on the resource (append-style ops fail otherwise).
  if (ndcChanged || medispanChanged || medispanForInteractionsChanged) {
    const otherCodings = existingCodings.filter(
      (c) =>
        c.system !== CODE_SYSTEM_NDC &&
        c.system !== MEDICATION_DISPENSABLE_DRUG_ID &&
        c.system !== MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS
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
    const newCoding = [
      ...otherCodings,
      ...resolvedNdcCoding,
      ...resolvedMedispanCoding,
      ...resolvedMedispanForInteractionsCoding,
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

  // Rebuild /extension as a single op for the same reason as /code/coding above.
  if (inventory !== undefined) {
    const existingInventory = getMedicationInventoryConfig(medication);
    const existingInventoryExtension = existingInventory ? makeMedicationInventoryExtension(existingInventory) : null;
    const inventoryExtension = inventory ? makeMedicationInventoryExtension(inventory) : null;
    if (JSON.stringify(existingInventoryExtension) !== JSON.stringify(inventoryExtension)) {
      const otherExtensions = (medication.extension ?? []).filter(
        (extension) => extension.url !== MEDICATION_INVENTORY_EXTENSION_URL
      );
      const newExtensions = inventoryExtension ? [...otherExtensions, inventoryExtension] : otherExtensions;
      if (medication.extension === undefined) {
        patchOperations.push({ op: 'add', path: '/extension', value: newExtensions });
      } else if (newExtensions.length > 0) {
        patchOperations.push({ op: 'replace', path: '/extension', value: newExtensions });
      } else {
        patchOperations.push({ op: 'remove', path: '/extension' });
      }
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
