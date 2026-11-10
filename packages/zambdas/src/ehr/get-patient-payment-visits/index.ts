import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, FhirResource, Location, PaymentNotice } from 'fhir/r4b';
import { getReasonForVisitFromAppointment } from 'utils/lib/fhir/appointments';
import { chunkThings } from 'utils/lib/fhir/chat';
import { isFollowupEncounter } from 'utils/lib/fhir/encounter';
import { getAllStripeCustomerAccountPairs, scheduleOwnerAmong } from 'utils/lib/fhir/helpers';
import { isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { getPaymentNoticeSubmitterRef, getStripeAccountForScheduleOwner } from 'utils/lib/fhir/payments';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  GetPatientPaymentVisitsInputSchema,
  GetPatientPaymentVisitsResponse,
  PatientPaymentVisit,
} from 'utils/lib/types/api/patient-payment-visits.types';
import { ServiceMode } from 'utils/lib/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { fetchPractitionerFirstLastNames } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { getAccountAndCoverageResourcesForPatient } from '../shared/harvest';
import { getAllFhirEncountersAndAppointmentsForPatient } from '../shared/patient-encounters';

const ZAMBDA_NAME = 'get-patient-payment-visits';
// keeps each request= OR list within URL limits
const ENCOUNTER_BATCH_SIZE = 50;

let m2mToken: string;

// The clinical side of a patient's payments, for billing: every visit with its schedule owner's
// Stripe account and the payments the EHR recorded on it, plus the patient's Stripe customers.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { patientId, encounterId, secrets } = validateWithSchema(GetPatientPaymentVisitsInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await getPatientPaymentVisits(oystehr, patientId, encounterId);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export const getPatientPaymentVisits = async (
  oystehr: Oystehr,
  patientId: string,
  // only this visit, searched by id alongside the patient, so another patient's is never returned
  encounterId?: string
): Promise<GetPatientPaymentVisitsResponse> => {
  const [visits, { account }] = await Promise.all([
    fetchVisits(oystehr, patientId, encounterId),
    getAccountAndCoverageResourcesForPatient(patientId, oystehr),
  ]);
  const legacyNoticesByEncounter = await fetchLegacyPaymentNotices(
    oystehr,
    visits.map((visit) => visit.encounterId)
  );
  await nameSubmitters(oystehr, [...legacyNoticesByEncounter.values()].flat());
  return {
    visits: visits.map((visit) => ({
      ...visit,
      legacyPaymentNotices: legacyNoticesByEncounter.get(visit.encounterId) ?? [],
    })),
    stripeCustomers: account ? getAllStripeCustomerAccountPairs(account).filter((customer) => customer.customerId) : [],
  };
};

// One paged search for every encounter (follow-ups included), or just the one asked for, with its
// appointment, the appointment's actors and its slot's schedule actor: the same candidates
// getScheduleOwnerFromAppointmentOrEncounter picks the schedule owner from. The encounter's
// locations come along too, so each visit can be told apart by where it took place.
const fetchVisits = async (
  oystehr: Oystehr,
  patientId: string,
  encounterId: string | undefined
): Promise<Omit<PatientPaymentVisit, 'legacyPaymentNotices'>[]> => {
  const { encounters, appointments, relatedResourcesByReference } = await getAllFhirEncountersAndAppointmentsForPatient(
    oystehr,
    patientId,
    {
      includeEncountersWithoutAppointment: true,
      includeScheduleOwnerCandidates: true,
      includeEncounterLocations: true,
      encounterId,
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
        serviceMode: appointment
          ? isTelemedAppointment(appointment)
            ? ServiceMode.virtual
            : ServiceMode['in-person']
          : undefined,
        followUp: isFollowupEncounter(encounter),
        locationName: visitLocation(encounter, appointment, relatedResourcesByReference)?.name,
        visitReason: getReasonForVisitFromAppointment(appointment) ?? encounter.reasonCode?.[0]?.text,
        ...(scheduleOwner ? { scheduleOwner: { stripeAccount: getStripeAccountForScheduleOwner(scheduleOwner) } } : {}),
      };
    });
};

// The appointment's location, as the EHR visit history shows it, else the encounter's own (a
// follow-up without an appointment has only that).
const visitLocation = (
  encounter: Encounter,
  appointment: Appointment | undefined,
  resourcesByReference: Map<string, FhirResource>
): Location | undefined =>
  [
    ...(appointment?.participant ?? []).map((participant) => participant.actor?.reference),
    ...(encounter.location ?? []).map((location) => location.location.reference),
  ]
    .map((reference) => (reference ? resourcesByReference.get(reference) : undefined))
    .find((resource): resource is Location => resource?.resourceType === 'Location');

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

// Notices written before the submitter's display name was stamped on them carry only a Practitioner
// reference. Billing can't read clinical Practitioners, so the names are filled in here (on the
// returned copies only), which is how billing shows who took a payment, as the EHR does.
const nameSubmitters = async (oystehr: Oystehr, notices: PaymentNotice[]): Promise<void> => {
  const unnamed = notices.flatMap((notice) => {
    const submitter = getPaymentNoticeSubmitterRef(notice);
    const practitionerId = submitter?.display ? undefined : getIdFromReference(submitter?.reference, 'Practitioner');
    return submitter && practitionerId ? [{ submitter, practitionerId }] : [];
  });
  if (unnamed.length === 0) return;

  let names = new Map<string, string>();
  try {
    // first + last only, matching the display stamped at write time
    names = await fetchPractitionerFirstLastNames(
      oystehr,
      unnamed.map(({ practitionerId }) => practitionerId)
    );
  } catch (error) {
    // an unnamed submitter only leaves "taken by" blank; it must not fail the payments
    console.error('Error resolving payment submitter names', error);
  }

  for (const { submitter, practitionerId } of unnamed) {
    const name = names.get(practitionerId);
    if (name) submitter.display = name;
  }
};
