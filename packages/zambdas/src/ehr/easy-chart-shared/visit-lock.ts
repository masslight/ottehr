// The signed-visit lock, enforced server-side for the Easy Chart endpoints that write. They write under the M2M
// token, so the EHR's read-only rule (appointment-accessibility.helper) would otherwise only hold in the browser.

import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter } from 'fhir/r4b';
import { EASY_CHART_VISIT_LOCKED_MESSAGE } from 'utils/lib/easy-chart/access';
import { getEncounterVisitType } from 'utils/lib/fhir/encounter';
import { isAppointmentLocked, isEncounterLocked } from 'utils/lib/fhir/helpers';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';

/**
 * The same rule as the EHR's `isAppointmentReadOnly`: an annotation follow-up has no Appointment of its own, so its
 * lock is on the Encounter; every other visit is locked through its Appointment.
 */
export async function isVisitLocked(oystehr: Oystehr, encounterId: string): Promise<boolean> {
  const resources = (
    await oystehr.fhir.search<Encounter | Appointment>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_include', value: 'Encounter:appointment' },
      ],
    })
  ).unbundle();
  const encounter = resources.find((r): r is Encounter => r.resourceType === 'Encounter');
  if (!encounter) throw INVALID_INPUT_ERROR('The visit could not be found');
  if (getEncounterVisitType(encounter) === 'follow-up') return isEncounterLocked(encounter);
  const appointment = resources.find((r): r is Appointment => r.resourceType === 'Appointment');
  return appointment ? isAppointmentLocked(appointment) : false;
}

/** Refuses the request when the visit is signed and locked. Applies to every caller, the service client included. */
export async function assertVisitIsEditable(oystehr: Oystehr, encounterId: string, zambdaName: string): Promise<void> {
  if (await isVisitLocked(oystehr, encounterId)) {
    console.log(`[${zambdaName}] refused: the visit is locked`);
    throw INVALID_INPUT_ERROR(EASY_CHART_VISIT_LOCKED_MESSAGE);
  }
}
