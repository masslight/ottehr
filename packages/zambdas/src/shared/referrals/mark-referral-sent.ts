import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { FhirResource, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getReferralStatus, isReferralServiceRequest, withReferralDetails } from 'utils/lib/fhir/referral';
import { isFhirVersionConflictError } from '../errors';
import { findOpenReferralTasks, referralTaskOverdueRequest } from './referral-task';

export const markReferralSent = async (
  referralId: string,
  faxedVersionId: string | undefined,
  oystehr: Oystehr
): Promise<void> => {
  try {
    const [serviceRequest, openTasks] = await Promise.all([
      oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: referralId }),
      findOpenReferralTasks(oystehr, referralId),
    ]);
    if (!isReferralServiceRequest(serviceRequest)) return;
    const status = getReferralStatus(serviceRequest);
    if (status !== 'not-sent' && status !== 'given-to-patient') return;
    if (!faxedVersionId || serviceRequest.meta?.versionId !== faxedVersionId) {
      logChangedSinceFaxed(referralId);
      return;
    }
    const sentAt = DateTime.now().toUTC().toISO() ?? new Date().toISOString();
    await oystehr.fhir.transaction<FhirResource>({
      requests: [
        {
          method: 'PUT',
          url: `/ServiceRequest/${referralId}`,
          resource: withReferralDetails(serviceRequest, { status: 'sent', sentAt }),
          ifMatch: makeOptimisticLockIfMatchHeader(faxedVersionId),
        },
        ...openTasks.map((task) => referralTaskOverdueRequest(task, sentAt)),
      ],
    });
    console.log(`[referral] marked ServiceRequest/${referralId} sent`);
  } catch (error) {
    if (isFhirVersionConflictError(error)) {
      logChangedSinceFaxed(referralId);
      return;
    }
    console.error(`[referral] failed to mark ServiceRequest/${referralId} sent`, error);
    captureException(error);
  }
};

const logChangedSinceFaxed = (referralId: string): void =>
  console.warn(`[referral] ServiceRequest/${referralId} changed after its fax was built; not marking it sent`);
