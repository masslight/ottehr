import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, FhirResource, PaymentNotice, Practitioner } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { getAllStripeCustomerAccountPairs, scheduleOwnerAmong } from 'utils/lib/fhir/helpers';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import { getPaymentNoticeSubmitterRef, getStripeAccountForScheduleOwner } from 'utils/lib/fhir/payments';
import { getIdFromReference } from 'utils/lib/fhir/reference';
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
import { getAllFhirEncountersAndAppointmentsForPatient } from '../shared/patient-encounters';

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

// One paged search for every encounter (follow-ups included) with its appointment, the appointment's
// actors and its slot's schedule actor: the same candidates getScheduleOwnerFromAppointmentOrEncounter
// picks the schedule owner from.
const fetchVisits = async (
  oystehr: Oystehr,
  patientId: string
): Promise<Omit<PatientPaymentVisit, 'legacyPaymentNotices'>[]> => {
  const { encounters, appointments, relatedResourcesByReference } = await getAllFhirEncountersAndAppointmentsForPatient(
    oystehr,
    patientId,
    {
      includeEncountersWithoutAppointment: true,
      includeScheduleOwnerCandidates: true,
    }
  );
  const appointmentsByReference = new Map(
    appointments.map((appointment) => [`Appointment/${appointment.id}`, appointment])
  );

  return encounters
    .filter((encounter): encounter is Encounter & { id: string } => Boolean(encounter.id))
    .map((encounter) => {
      const appointmentReference = encounter.appointment?.[0]?.reference;
      const appointment = appointmentReference ? appointmentsByReference.get(appointmentReference) : undefined;
      const scheduleOwner = appointment
        ? scheduleOwnerAmong(scheduleOwnerCandidates(appointment, relatedResourcesByReference))
        : undefined;
      return {
        encounterId: encounter.id,
        appointmentId: appointment?.id,
        visitDateISO: appointment?.start ?? encounter.period?.start,
        ...(scheduleOwner ? { scheduleOwner: { stripeAccount: getStripeAccountForScheduleOwner(scheduleOwner) } } : {}),
      };
    });
};

// The appointment's actors plus the actor of each schedule its slots belong to, so a location that is
// only linked through the schedule is still found.
const scheduleOwnerCandidates = (
  appointment: Appointment,
  resourcesByReference: Map<string, FhirResource>
): FhirResource[] => {
  const lookup = (reference: string | undefined): FhirResource[] => {
    const resource = reference ? resourcesByReference.get(reference) : undefined;
    return resource ? [resource] : [];
  };
  const appointmentActors = (appointment.participant ?? []).flatMap((participant) =>
    lookup(participant.actor?.reference)
  );
  const scheduleActors = (appointment.slot ?? [])
    .flatMap((slotReference) => lookup(slotReference.reference))
    .flatMap((slot) => (slot.resourceType === 'Slot' ? lookup(slot.schedule.reference) : []))
    .flatMap((schedule) => (schedule.resourceType === 'Schedule' ? schedule.actor : []))
    .flatMap((actor) => lookup(actor.reference));
  return [...appointmentActors, ...scheduleActors];
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
        const encounterId = getIdFromReference(notice.request?.reference, 'Encounter');
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
        .filter((submitter) => !submitter?.display)
        .flatMap((submitter) => getIdFromReference(submitter?.reference, 'Practitioner') ?? [])
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
