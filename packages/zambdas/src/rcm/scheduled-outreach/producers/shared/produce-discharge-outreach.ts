import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils';
import { OutreachTaskResult, produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceDischargeOutreachParams {
  /** The Encounter resource, or an encounter ID to fetch it */
  encounter?: Encounter;
  encounterId?: string;
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
  const { oystehr } = params;

  let encounter: Encounter;
  if (params.encounter) {
    encounter = params.encounter;
  } else if (params.encounterId) {
    encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: params.encounterId,
    });
  } else {
    throw INVALID_INPUT_ERROR('Expected either encounter or encounterId');
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
