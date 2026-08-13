import type { ExamItemConfig } from 'config-types';
import { Appointment, Encounter } from 'fhir/r4b';
import { useMemo } from 'react';
import { collectKnownExamFields } from 'utils/lib/config-helpers/exam-observations';
import { encounterHasLegacyExamVersion } from 'utils/lib/fhir/encounter';
import { isAppointmentLocked } from 'utils/lib/fhir/helpers';
import { isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { useExamObservationsStore } from '../../stores/appointment/exam-observations.store';

interface ExamConfigState {
  unmatchedExamFields: string[];
  displayExamMigrationWarning: boolean;
  hasIncompatibleExamConfig: boolean;
}

// One CHECKED exam observation, reduced to what the mismatch check needs. Both the appointment
// store's keyed record and a plain ExamObservationDTO[] collapse to this shape.
export interface ExamConfigStateInput {
  config: ExamItemConfig;
  checkedFields: string[];
  appointment?: Appointment;
  encounter?: Encounter;
}

// The exam-config mismatch computation, with no store dependency: the same encounter can be charted
// from the exam tab / progress note (which read the appointment store) or from the Easy Chart page
// (which deliberately does not populate it — see the comment in EasyChartPage). Both surfaces must
// reach the SAME verdict, so the logic lives here once and each caller supplies its own inputs.
export function computeExamConfigState({
  config,
  checkedFields,
  appointment,
  encounter,
}: ExamConfigStateInput): ExamConfigState {
  const knownFields = collectKnownExamFields(config);
  // A checked observation whose field the current config doesn't define came from an older exam
  // layout — it is on the chart but cannot be rendered or edited until it's migrated.
  const unmatchedExamFields = checkedFields.filter((field) => !knownFields.has(field));

  const appointmentLocked = appointment ? isAppointmentLocked(appointment) : false;
  const hasIncompatibleExamConfig =
    isTelemedAppointment(appointment) && !!encounter && encounterHasLegacyExamVersion(encounter) && appointmentLocked;

  return {
    unmatchedExamFields,
    displayExamMigrationWarning: unmatchedExamFields.length > 0,
    hasIncompatibleExamConfig,
  };
}

export function useExamConfigState(config: ExamItemConfig): ExamConfigState {
  const { appointment, encounter } = useAppointmentData();
  const examObservations = useExamObservationsStore();

  return useMemo(
    () =>
      computeExamConfigState({
        config,
        checkedFields: Object.keys(examObservations).filter((field) => examObservations[field]?.value === true),
        appointment,
        encounter,
      }),
    [config, examObservations, appointment, encounter]
  );
}
