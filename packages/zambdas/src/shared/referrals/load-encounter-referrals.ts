import Oystehr from '@oystehr/sdk';
import { Organization, ServiceRequest } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  getReferralDetails,
  getReferralReason,
  getReferralRecipientContactId,
  getReferralSpecialty,
  getReferralStatus,
  getReferralUrgency,
  isReferralServiceRequest,
  REFERRAL_ORDER_TYPE_TAG_TOKEN,
} from 'utils/lib/fhir/referral';
import {
  REFERRAL_DEFAULTS,
  ReferralAsk,
  ReferralScheduler,
  ReferralStatus,
  ReferralUrgency,
} from 'utils/lib/types/api/referrals/referrals.types';
import { mapReferralRecipient } from './recipient';

/** A visit's referral as the discharge summary and progress note print it. */
export interface EncounterReferral {
  id: string;
  specialty: string;
  reason: string;
  urgency: ReferralUrgency;
  whatIsAsked: ReferralAsk;
  whoSchedules: ReferralScheduler;
  responseRequested: boolean;
  status: ReferralStatus;
  /** ISO; when the referral was written. */
  authoredOn?: string;
  /** ISO; when it went out. The overdue window for the patient counts from here, else from `authoredOn`. */
  sentAt?: string;
  /** Absent when the patient will choose the specialist. */
  recipient?: { name: string; address?: string; phone?: string };
}

export const mapEncounterReferral = (
  serviceRequest: ServiceRequest,
  organizationsById: Map<string, Organization>
): EncounterReferral => {
  const details = getReferralDetails(serviceRequest);
  const contactId = getReferralRecipientContactId(serviceRequest);
  const organization = contactId ? organizationsById.get(contactId) : undefined;
  const recipient = organization ? mapReferralRecipient(organization) : undefined;
  return {
    id: serviceRequest.id ?? '',
    specialty: getReferralSpecialty(serviceRequest),
    reason: getReferralReason(serviceRequest),
    urgency: getReferralUrgency(serviceRequest),
    whatIsAsked: details?.whatIsAsked ?? REFERRAL_DEFAULTS.whatIsAsked,
    whoSchedules: details?.whoSchedules ?? REFERRAL_DEFAULTS.whoSchedules,
    responseRequested: details?.responseRequested ?? REFERRAL_DEFAULTS.responseRequested,
    status: getReferralStatus(serviceRequest),
    authoredOn: serviceRequest.authoredOn,
    sentAt: details?.sentAt,
    recipient: recipient
      ? {
          name: recipient.name || serviceRequest.performer?.[0]?.display || '',
          address: recipient.address,
          phone: recipient.phone,
        }
      : undefined,
  };
};

/** The visit's referrals (cancelled ones left out) with their address-book recipients, oldest first. */
export const loadEncounterReferrals = async (oystehr: Oystehr, encounterId: string): Promise<EncounterReferral[]> => {
  const resources = await getAllFhirSearchPages<ServiceRequest | Organization>(
    {
      resourceType: 'ServiceRequest',
      params: [
        { name: '_tag', value: REFERRAL_ORDER_TYPE_TAG_TOKEN },
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: '_include', value: 'ServiceRequest:performer' },
      ],
    },
    oystehr
  );
  const organizationsById = new Map<string, Organization>();
  resources.forEach((resource) => {
    if (resource.resourceType === 'Organization' && resource.id) organizationsById.set(resource.id, resource);
  });
  return resources
    .filter(
      (resource): resource is ServiceRequest =>
        resource.resourceType === 'ServiceRequest' &&
        isReferralServiceRequest(resource) &&
        getReferralStatus(resource) !== 'cancelled'
    )
    .sort((a, b) => (a.authoredOn ?? '').localeCompare(b.authoredOn ?? ''))
    .map((serviceRequest) => mapEncounterReferral(serviceRequest, organizationsById));
};
