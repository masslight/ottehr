import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getReferralStatus, ReferralDetails, withReferralDetails } from 'utils/lib/fhir/referral';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  isReferralOpen,
  REFERRAL_ROLES,
  REFERRAL_STATUS_LABELS,
  UpdateReferralStatusInput,
  UpdateReferralStatusOutput,
} from 'utils/lib/types/api/referrals/referrals.types';
import { INVALID_INPUT_ERROR, PRECONDITION_FAILED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { isFhirVersionConflictError } from '../../../shared/errors';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { loadReferral } from '../../../shared/referrals/load-referral';
import { setReferralTaskOverdue } from '../../../shared/referrals/referral-task';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { buildReferralDTOs, settleReferralTasks } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'update-referral-status';

let m2mToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);
    await requireUserWithRole(getUserToken(input), params.secrets, REFERRAL_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);

    const referral = await loadReferral(oystehr, params.referralId);
    const { patch, taskStatus, taskClockStart } = transition(referral, params);
    const saved = await oystehr.fhir
      .update<ServiceRequest>(withReferralDetails(referral, patch), {
        optimisticLockingVersionId: referral.meta?.versionId,
      })
      .catch((error: unknown) => {
        if (isFhirVersionConflictError(error)) {
          throw PRECONDITION_FAILED('This referral was changed by someone else; reload it and try again');
        }
        throw error;
      });
    if (taskStatus) await settleReferralTasks(oystehr, params.referralId, taskStatus);
    if (taskClockStart) await setReferralTaskOverdue(oystehr, params.referralId, taskClockStart);

    const [dto] = await buildReferralDTOs(oystehr, [saved]);
    const output: UpdateReferralStatusOutput = { referral: dto };
    return { statusCode: 200, body: JSON.stringify(output) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

/**
 * The details patch for the requested action, and what happens to the referral's open task: settled to
 * `taskStatus`, or its overdue clock started from `taskClockStart`.
 */
export const transition = (
  referral: ServiceRequest,
  params: UpdateReferralStatusInput
): { patch: Partial<ReferralDetails>; taskStatus?: 'completed' | 'cancelled'; taskClockStart?: string } => {
  const status = getReferralStatus(referral);
  const now = DateTime.now().toUTC().toISO() ?? new Date().toISOString();
  const refuse = (): never => {
    throw INVALID_INPUT_ERROR(`A ${REFERRAL_STATUS_LABELS[status].toLowerCase()} referral cannot be ${params.action}`);
  };

  switch (params.action) {
    case 'close':
      if (!isReferralOpen(status)) refuse();
      return {
        patch: { status: 'closed', closedAt: now, closeReason: params.reason, outcome: params.outcome },
        taskStatus: 'completed',
      };
    case 'cancel':
      if (!isReferralOpen(status)) refuse();
      return { patch: { status: 'cancelled', closedAt: now }, taskStatus: 'cancelled' };
    case 'given-to-patient':
      // A fax to the provider wins the status: once sent, the copy is only recorded and the clock keeps running.
      if (status === 'sent' || status === 'given-to-patient') return { patch: { givenToPatientAt: now } };
      if (status !== 'not-sent') refuse();
      return { patch: { status: 'given-to-patient', givenToPatientAt: now }, taskClockStart: now };
  }
};
