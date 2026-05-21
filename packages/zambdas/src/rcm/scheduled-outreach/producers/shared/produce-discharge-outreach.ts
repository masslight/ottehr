import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils';
import { OutreachTaskResult, produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceDischargeOutreachParams {
  /** Encounter ID to fetch */
  encounterId: string;
  /** When true, validates the encounter is in 'finished' status before proceeding */
  validateStatus?: boolean;
  oystehr: Oystehr;
}

export interface ProduceDischargeOutreachResult {
  discharge: OutreachTaskResult;
  dateOfVisit: OutreachTaskResult;
}

/**
 * Creates outreach tasks triggered by patient discharge.
 *
 * Produces tasks for both `discharge-time` and `date-of-visit` trigger events.
 * Can be called directly from another zambda or from the zambda handler.
 */
export async function produceDischargeOutreach(
  params: ProduceDischargeOutreachParams
): Promise<ProduceDischargeOutreachResult> {
  const { encounterId, oystehr } = params;

  let encounter: Encounter;
  try {
    encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });
  } catch {
    throw INVALID_INPUT_ERROR(`Encounter ${encounterId} could not be found`);
  }

  if (params.validateStatus && encounter.status !== 'finished') {
    throw INVALID_INPUT_ERROR(
      `Encounter ${encounter.id} is in '${encounter.status}' status, expected 'finished' (discharged)`
    );
  }

  if (!encounter.subject?.reference) {
    throw INVALID_INPUT_ERROR(`Encounter ${encounter.id} has no subject (patient) reference`);
  }

  const appointmentRef = encounter.appointment?.[0]?.reference
    ? { reference: encounter.appointment[0].reference }
    : undefined;

  // Use the encounter's end time (discharge time) or period end, falling back to now
  const dischargeTime = encounter.period?.end || new Date().toISOString();

  const discharge = await produceOutreachTasks({
    triggerEvent: 'discharge-time',
    patient: encounter.subject,
    focus: { reference: `Encounter/${encounter.id}` },
    appointment: appointmentRef,
    eventTimestamp: dischargeTime,
    oystehr,
  });

  // Also produce date-of-visit tasks (same event source, different trigger)
  const visitDate = encounter.period?.start || dischargeTime;
  const dateOfVisit = await produceOutreachTasks({
    triggerEvent: 'date-of-visit',
    patient: encounter.subject,
    focus: { reference: `Encounter/${encounter.id}` },
    appointment: appointmentRef,
    eventTimestamp: visitDate,
    oystehr,
  });

  return { discharge, dateOfVisit };
}
