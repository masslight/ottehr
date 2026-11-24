import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getReferralStatus, withReferralDetails } from 'utils/lib/fhir/referral';
import { isFhirVersionConflictError } from '../errors';
import { setReferralTaskOverdue } from './referral-task';

const MARK_REFERRAL_SENT_RETRIES = 3;

/**
 * Moves a referral to Sent after its fax went out, and starts the overdue clock on its "awaiting response" task
 * from that moment. Only a referral still waiting to go out changes: one already answered keeps Response received.
 * Never throws — the fax has gone out, so a failure here is captured rather than failing the caller.
 */
export const markReferralSent = async (referralId: string, oystehr: Oystehr): Promise<void> => {
  try {
    for (let attempt = 1; attempt <= MARK_REFERRAL_SENT_RETRIES; attempt++) {
      const serviceRequest = await oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: referralId });
      const status = getReferralStatus(serviceRequest);
      if (status !== 'not-sent' && status !== 'given-to-patient') return;
      const sentAt = DateTime.now().toUTC().toISO() ?? new Date().toISOString();
      try {
        await oystehr.fhir.update<ServiceRequest>(withReferralDetails(serviceRequest, { status: 'sent', sentAt }), {
          optimisticLockingVersionId: serviceRequest.meta?.versionId,
        });
      } catch (error) {
        if (!isFhirVersionConflictError(error) || attempt === MARK_REFERRAL_SENT_RETRIES) throw error;
        console.warn(`[referral] ServiceRequest/${referralId} changed while marking it sent; retrying`);
        continue;
      }
      console.log(`[referral] marked ServiceRequest/${referralId} sent`);
      await setReferralTaskOverdue(oystehr, referralId, sentAt);
      return;
    }
  } catch (error) {
    console.error(`[referral] failed to mark ServiceRequest/${referralId} sent`, error);
    captureException(error);
  }
};
