import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { FhirResource, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getReferralStatus, isReferralServiceRequest, withReferralDetails } from 'utils/lib/fhir/referral';
import { isFhirVersionConflictError } from '../errors';
import { findOpenReferralTasks, referralTaskOverdueRequest } from './referral-task';

const MARK_REFERRAL_SENT_RETRIES = 3;

export const markReferralSent = async (referralId: string, oystehr: Oystehr): Promise<void> => {
  try {
    for (let attempt = 1; attempt <= MARK_REFERRAL_SENT_RETRIES; attempt++) {
      const [serviceRequest, openTasks] = await Promise.all([
        oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: referralId }),
        findOpenReferralTasks(oystehr, referralId),
      ]);
      if (!isReferralServiceRequest(serviceRequest)) return;
      const status = getReferralStatus(serviceRequest);
      if (status !== 'not-sent' && status !== 'given-to-patient') return;
      const sentAt = DateTime.now().toUTC().toISO() ?? new Date().toISOString();
      try {
        await oystehr.fhir.transaction<FhirResource>({
          requests: [
            {
              method: 'PUT',
              url: `/ServiceRequest/${referralId}`,
              resource: withReferralDetails(serviceRequest, { status: 'sent', sentAt }),
              ifMatch: makeOptimisticLockIfMatchHeader(serviceRequest),
            },
            ...openTasks.map((task) => referralTaskOverdueRequest(task, sentAt)),
          ],
        });
      } catch (error) {
        if (!isFhirVersionConflictError(error) || attempt === MARK_REFERRAL_SENT_RETRIES) throw error;
        console.warn(`[referral] ServiceRequest/${referralId} changed while marking it sent; retrying`);
        continue;
      }
      console.log(`[referral] marked ServiceRequest/${referralId} sent`);
      return;
    }
  } catch (error) {
    console.error(`[referral] failed to mark ServiceRequest/${referralId} sent`, error);
    captureException(error);
  }
};
