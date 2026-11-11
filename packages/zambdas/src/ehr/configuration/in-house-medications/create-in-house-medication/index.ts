import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coding, Medication } from 'fhir/r4b';
import { makeMedicationInventoryExtension } from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { VACCINE_DEFAULT_INVENTORY } from 'utils/lib/types/api/config/in-house-medications';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_MEDICATION_TYPE_CODE,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { ADMIN_TIER_ROLES } from 'utils/lib/types/api/user.types';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-create-in-house-medication',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { name, ndc, medispanID, medispanIDForInteractions, vaccine, secrets } = validateRequestParameters(input);

    // Adding to the catalog is admin-tier, as editing it is.
    await requireUserWithRole(getUserToken(input), secrets, ADMIN_TIER_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = vaccine
      ? await createVaccine(oystehr, vaccine.cvx)
      : await performEffect(oystehr, name!, ndc, medispanID!, medispanIDForInteractions);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

/**
 * Switches a vaccine on: one catalog entry per CVX code, named as the CDC names it, with its inventory set up
 * (counted in doses) so lots can be received at once. Switching on a vaccine already in the catalog reactivates it.
 */
export const createVaccine = async (oystehr: Oystehr, cvx: string): Promise<Medication> => {
  const vaccine = getCvxVaccine(cvx);
  if (!vaccine) throw INVALID_INPUT_ERROR(`CVX ${cvx} is not in the vaccine list`);
  const existing = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${MEDICATION_TYPE_SYSTEM}|${INVENTORY_VACCINE_TYPE_CODE}` },
        { name: 'code', value: `${CVX_CODE_SYSTEM_URL}|${cvx}` },
      ],
    })
  ).unbundle();
  const match = existing.find((medication) => medication.id);
  if (match?.id) {
    if (match.status === 'active') return match;
    return oystehr.fhir.patch<Medication>({
      resourceType: 'Medication',
      id: match.id,
      operations: [{ op: match.status ? 'replace' : 'add', path: '/status', value: 'active' }],
    });
  }
  return oystehr.fhir.create<Medication>({
    resourceType: 'Medication',
    identifier: [
      { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
      { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: vaccine.name },
    ],
    status: 'active',
    code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: vaccine.cvx, display: vaccine.fullName }] },
    extension: [makeMedicationInventoryExtension(VACCINE_DEFAULT_INVENTORY)],
  });
};

export const performEffect = async (
  oystehr: Oystehr,
  name: string,
  ndc: string | undefined,
  medispanID: string,
  medispanIDForInteractions?: string
): Promise<Medication> => {
  const coding: Coding[] = [];
  if (ndc) {
    coding.push({ system: CODE_SYSTEM_NDC, code: ndc });
  }
  coding.push({
    system: MEDICATION_DISPENSABLE_DRUG_ID,
    code: medispanID,
  });
  if (medispanIDForInteractions) {
    coding.push({
      system: MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
      code: medispanIDForInteractions,
    });
  }
  const medication = await oystehr.fhir.create<Medication>({
    resourceType: 'Medication',
    identifier: [
      {
        system: MEDICATION_TYPE_SYSTEM,
        value: INVENTORY_MEDICATION_TYPE_CODE,
      },
      {
        system: MEDICATION_IDENTIFIER_NAME_SYSTEM,
        value: name,
      },
    ],
    status: 'active',
    code: { coding: coding },
  });
  return medication;
};
