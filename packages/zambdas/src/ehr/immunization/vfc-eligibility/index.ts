import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import {
  VfcEligibilityInput,
  VfcEligibilityInputSchema,
  VfcEligibilityResponse,
} from 'utils/lib/types/api/vfc-eligibility';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import {
  confirmVfcEligibility,
  deriveVisitVfcEligibility,
  getConfirmedVfcEligibility,
  getVfcVisit,
  vfcApplies,
} from '../../../shared/vfc';

let m2mToken: string;

const ZAMBDA_NAME = 'vfc-eligibility';

/**
 * A visit's VFC eligibility: what the paperwork says and what staff confirmed. The encounter id names the
 * visit; the search is fixed here, and the caller must hold a staff role (patient data, read by staff only).
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, ...params } = validateWithSchema(VfcEligibilityInputSchema, input);

  const user = await requireUserWithRole(getUserToken(input), secrets, INVENTORY_STAFF_ROLES);
  const practitionerId = getIdFromReference(user.profile, 'Practitioner');
  if (!practitionerId) throw new Error("Can't receive practitioner resource id attached to current user");

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await performEffect(oystehr, params, `Practitioner/${practitionerId}`);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const performEffect = async (
  oystehr: Oystehr,
  params: VfcEligibilityInput,
  performerReference: string
): Promise<VfcEligibilityResponse> => {
  const visit = await getVfcVisit(oystehr, params.encounterId);
  if (!visit) throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  if (!vfcApplies(visit.patient)) {
    if (params.action === 'confirm') throw INVALID_INPUT_ERROR('VFC eligibility is only recorded for patients 18 and younger.');
    return { applies: false };
  }
  if (params.action === 'confirm') {
    await confirmVfcEligibility(oystehr, visit, params.code, performerReference);
  }
  const [derived, confirmed] = await Promise.all([
    deriveVisitVfcEligibility(oystehr, visit),
    getConfirmedVfcEligibility(oystehr, params.encounterId),
  ]);
  return { applies: true, ...(derived ? { derived } : {}), ...(confirmed ? { confirmed } : {}) };
};
