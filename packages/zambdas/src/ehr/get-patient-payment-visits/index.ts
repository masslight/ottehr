import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, FhirResource, PaymentNotice, Practitioner } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { getAllStripeCustomerAccountPairs, scheduleOwnerAmong } from 'utils/lib/fhir/helpers';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import { getPaymentNoticeSubmitterRef, getStripeAccountForScheduleOwner } from 'utils/lib/fhir/payments';
import {
  GetPatientPaymentVisitsInputSchema,
  GetPatientPaymentVisitsResponse,
  PatientPaymentVisit,
} from 'utils/lib/types/api/patient-payment-visits.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getAccountAndCoverageResourcesForPatient } from '../shared/harvest';

const ZAMBDA_NAME = 'get-patient-payment-visits';
// keeps each request= OR list within URL limits
const ENCOUNTER_BATCH_SIZE = 50;
const PRACTITIONER_BATCH_SIZE = 100;

let m2mToken: string;

// The clinical side of a patient's payments, for billing: every visit with its schedule owner's
// Stripe account and the payments the EHR recorded on it, plus the patient's Stripe customers.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, secrets } = validateWithSchema(GetPatientPaymentVisitsInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await getPatientPaymentVisits(oystehr, patientId);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export const getPatientPaymentVisits = async (
  oystehr: Oystehr,
  patientId: string
): Promise<GetPatientPaymentVisitsResponse> => {
  const [visits, { account }] = await Promise.all([
    fetchVisits(oystehr, patientId),
    getAccountAndCoverageResourcesForPatient(patientId, oystehr),
  ]);
  const legacyNoticesByEncounter = await fetchLegacyPaymentNotices(
    oystehr,
    visits.map((visit) => visit.encounterId)
  );
  const nameSubmitter = await submitterNamer(oystehr, [...legacyNoticesByEncounter.values()].flat());
  return {
    visits: visits.map((visit) => ({
      ...visit,
      legacyPaymentNotices: (legacyNoticesByEncounter.get(visit.encounterId) ?? []).map(nameSubmitter),
    })),
    stripeCustomers: account ? getAllStripeCustomerAccountPairs(account).filter((customer) => customer.customerId) : [],
  };
};

// One paged search for every encounter with its appointment and the appointment's actors, among
// which getScheduleOwnerFromAppointmentOrEncounter finds the schedule owner.
const fetchVisits = async (
  oystehr: Oystehr,
  patientId: string
): Promise<Omit<PatientPaymentVisit, 'legacyPaymentNotices'>[]> => {
  const encounters: Encounter[] = [];
  const resourcesByReference = new Map<string, FhirResource>();
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<FhirResource>({
      resourceType: 'Encounter',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: '_include', value: 'Encounter:appointment' },
        { name: '_include:iterate', value: 'Appointment:actor' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    for (const resource of bundle.unbundle()) {
      if (resource.resourceType === 'Encounter') encounters.push(resource);
      else if (resource.id) resourcesByReference.set(`${resource.resourceType}/${resource.id}`, resource);
    }
    return bundle;
  }, 100);

  return encounters
    .filter((encounter): encounter is Encounter & { id: string } => Boolean(encounter.id))
    .map((encounter) => {
      const appointmentReference = encounter.appointment?.[0]?.reference;
      const appointment = appointmentReference
        ? (resourcesByReference.get(appointmentReference) as Appointment | undefined)
        : undefined;
      const actors = (appointment?.participant ?? [])
        .map((participant) => resourcesByReference.get(participant.actor?.reference ?? ''))
        .filter((resource): resource is FhirResource => Boolean(resource));
      const scheduleOwner = appointment ? scheduleOwnerAmong(actors) : undefined;
      return {
        encounterId: encounter.id,
        appointmentId: appointment?.id,
        visitDateISO: appointment?.start ?? encounter.period?.start,
        ...(scheduleOwner ? { scheduleOwner: { stripeAccount: getStripeAccountForScheduleOwner(scheduleOwner) } } : {}),
      };
    });
};

// Payments the EHR recorded against each encounter. The clinical client skips billing-tagged notices.
const fetchLegacyPaymentNotices = async (
  oystehr: Oystehr,
  encounterIds: string[]
): Promise<Map<string, PaymentNotice[]>> => {
  const noticesByEncounter = new Map<string, PaymentNotice[]>();
  for (const batch of chunkThings(encounterIds, ENCOUNTER_BATCH_SIZE)) {
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [
          { name: 'request', value: batch.map((id) => `Encounter/${id}`).join(',') },
          { name: '_count', value: String(count) },
          { name: '_offset', value: String(offset) },
        ],
      });
      for (const notice of bundle.unbundle()) {
        const encounterId = notice.request?.reference?.replace('Encounter/', '');
        if (!encounterId) continue;
        noticesByEncounter.set(encounterId, [...(noticesByEncounter.get(encounterId) ?? []), notice]);
      }
      return bundle;
    }, 100);
  }
  return noticesByEncounter;
};

// Notices written before the submitter's name was stamped on its reference name it here, so billing
// shows who took a payment without reading Practitioners.
const submitterNamer = async (
  oystehr: Oystehr,
  notices: PaymentNotice[]
): Promise<(notice: PaymentNotice) => PaymentNotice> => {
  const unnamedIds = [
    ...new Set(
      notices
        .map(getPaymentNoticeSubmitterRef)
        .filter((submitter) => submitter?.reference?.startsWith('Practitioner/') && !submitter.display)
        .map((submitter) => submitter?.reference?.slice('Practitioner/'.length) ?? '')
    ),
  ];
  const nameByReference = new Map<string, string>();
  for (const batch of chunkThings(unnamedIds, PRACTITIONER_BATCH_SIZE)) {
    try {
      const practitioners = (
        await oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [
            { name: '_id', value: batch.join(',') },
            { name: '_count', value: String(batch.length) },
          ],
        })
      ).unbundle();
      for (const practitioner of practitioners) {
        // first + last only, matching the display stamped at write time
        const name = [getFirstName(practitioner), getLastName(practitioner)].filter(Boolean).join(' ');
        if (practitioner.id && name) nameByReference.set(`Practitioner/${practitioner.id}`, name);
      }
    } catch (error) {
      // a payment still lists without its submitter's name
      console.error('Error resolving payment submitter names', error);
    }
  }

  return (notice) => {
    const submitter = getPaymentNoticeSubmitterRef(notice);
    const display = !submitter?.display && nameByReference.get(submitter?.reference ?? '');
    if (!display) return notice;
    return {
      ...notice,
      contained: notice.contained?.map((resource) =>
        resource.resourceType === 'PaymentReconciliation'
          ? {
              ...resource,
              detail: resource.detail?.map((detail) =>
                detail.submitter === submitter ? { ...detail, submitter: { ...submitter, display } } : detail
              ),
            }
          : resource
      ),
    };
  };
};
