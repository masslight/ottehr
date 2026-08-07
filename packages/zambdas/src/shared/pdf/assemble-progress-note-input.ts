import Oystehr from '@oystehr/sdk';
import {
  OTTEHR_MODULE,
  progressNoteChartDataRequestedFields,
  removePrefix,
  telemedProgressNoteChartDataRequestedFields,
} from 'utils';
import { getChartData } from '../../ehr/get-chart-data';
import { getMedicationOrders } from '../../ehr/get-medication-orders';
import { getImmunizationOrders } from '../../ehr/immunization/get-orders';
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
  visitResources: FullAppointmentResourcePackage
): Promise<ProgressNoteInput> {
  const { encounter, patient, appointment } = visitResources;
  if (!patient) throw new Error(`No patient found for encounter ${encounter?.id}`);
  const encounterId = encounter.id!;

  const isInPersonAppointment = !!appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

  // Follow-ups hang off the top-level encounter, so resolve to the parent if this one is a follow-up.
  const followUpParentEncounterId = removePrefix('Encounter/', encounter.partOf?.reference ?? '') ?? encounterId;

  const [chartDataResult, additionalChartDataResult, medicationOrdersData, upcomingFollowUps, signatures] =
    await Promise.all([
      getChartData(oystehr, token, encounterId),
      getChartData(
        oystehr,
        token,
        encounterId,
        isInPersonAppointment ? progressNoteChartDataRequestedFields : telemedProgressNoteChartDataRequestedFields
      ),
      getMedicationOrders(oystehr, { searchBy: { field: 'encounterId', value: encounterId } }),
      getUpcomingFollowUps(oystehr, followUpParentEncounterId, visitResources.timezone, encounter.id),
      // Supplementary: a signature lookup failure must not block PDF generation.
      getEncounterSignatures(oystehr, encounterId).catch((error) => {
        console.error(`Failed to resolve encounter signatures for encounter ${encounterId}:`, error);
        return { signedBy: undefined, approvedBy: undefined };
      }),
    ]);

  const immunizationOrders = (await getImmunizationOrders(oystehr, { encounterIds: [encounterId] })).orders;
  const chartData = chartDataResult.response;
  const additionalChartData = additionalChartDataResult.response;
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
  };
}
