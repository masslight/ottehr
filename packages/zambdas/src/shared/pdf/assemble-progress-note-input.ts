import Oystehr from '@oystehr/sdk';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { removePrefix } from 'utils/lib/helpers/helpers';
import {
  progressNoteNoteTypes,
  telemedProgressNoteNoteTypes,
} from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { visitNoteToLegacyChartData } from 'utils/lib/helpers/visit-note/visit-note-to-chart-data.helper';
import { getMedicationOrders } from '../../ehr/get-medication-orders';
import { getImmunizationOrders } from '../../ehr/immunization/get-orders';
import { buildVisitNote } from '../chart-sections/visit-note';
import { fetchErxPharmacies } from '../erx';
import { getEncounterSignatures } from './get-encounter-signatures';
import { getUpcomingFollowUps } from './get-upcoming-follow-ups';
import { ProgressNoteInput } from './types';
import { FullAppointmentResourcePackage } from './visit-details-pdf/types';

/**
 * Gathers every piece of chart data the visit/progress note PDF needs into a `ProgressNoteInput`.
 *
 * Single source of truth for that assembly: both the visit-note subscription (which persists the note after
 * signing) and the outbound-fax collector (which regenerates it on the fly for an unsigned visit) call this,
 * so a faxed note can never diverge from the one that will be stored.
 */
export async function assembleProgressNoteInput(
  oystehr: Oystehr,
  token: string,
  visitResources: FullAppointmentResourcePackage,
  options?: {
    signed?: boolean;
  }
): Promise<ProgressNoteInput> {
  const { encounter, patient, appointment } = visitResources;
  if (!patient) throw new Error(`No patient found for encounter ${encounter?.id}`);
  const encounterId = encounter.id!;

  const isInPersonAppointment = !!appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

  // Follow-ups hang off the top-level encounter, so resolve to the parent if this one is a follow-up.
  const followUpParentEncounterId = removePrefix('Encounter/', encounter.partOf?.reference ?? '') ?? encounterId;

  const [visitNote, medicationOrdersData, upcomingFollowUps, signatures] = await Promise.all([
    buildVisitNote({ oystehr, m2mToken: token }, encounterId, {
      noteTypes: isInPersonAppointment ? progressNoteNoteTypes : telemedProgressNoteNoteTypes,
    }),
    getMedicationOrders(oystehr, { searchBy: { field: 'encounterId', value: encounterId } }),
    getUpcomingFollowUps(oystehr, followUpParentEncounterId, visitResources.timezone, encounter.id),
    // Supplementary: a signature lookup failure must not block PDF generation.
    getEncounterSignatures(oystehr, encounterId).catch((error) => {
      console.error(`Failed to resolve encounter signatures for encounter ${encounterId}:`, error);
      return { signedBy: undefined, approvedBy: undefined };
    }),
  ]);

  const immunizationOrders = (await getImmunizationOrders(oystehr, { encounterIds: [encounterId] })).orders;
  // The composers read the two whole-chart shapes; the adapter presents the note as both.
  const { chartData, additionalChartData } = visitNoteToLegacyChartData(visitNote, {
    module: isInPersonAppointment ? 'in-person' : 'telemed',
  });
  const medicationOrders = medicationOrdersData?.orders.filter((order) => order.status !== 'cancelled');
  const erxPharmacies = await fetchErxPharmacies(oystehr, additionalChartData?.prescribedMedications);

  return {
    patient,
    encounter,
    allChartData: { chartData, additionalChartData, medicationOrders, immunizationOrders },
    appointmentPackage: visitResources,
    questionnaireResponse: visitResources.questionnaireResponse,
    upcomingFollowUps,
    erxPharmacies,
    signatures,
    signed: options?.signed,
  };
}
