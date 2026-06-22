import type { ExamItemConfig } from 'config-types';
import { useMemo } from 'react';
import {
  collectKnownExamFields,
  encounterHasLegacyExamVersion,
  isAppointmentLocked,
  isTelemedAppointment,
} from 'utils';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { useExamObservationsStore } from '../../stores/appointment/exam-observations.store';

interface ExamConfigState {
  unmatchedExamFields: string[];
  displayExamMigrationWarning: boolean;
  hasIncompatibleExamConfig: boolean;
}

export function useExamConfigState(config: ExamItemConfig): ExamConfigState {
  const { appointment, encounter } = useAppointmentData();
  const examObservations = useExamObservationsStore();

  const knownFields = useMemo(() => collectKnownExamFields(config), [config]);

  const { unmatchedExamFields, displayExamMigrationWarning } = useMemo(() => {
    const unmatchedExamFields = Object.keys(examObservations).filter(
      (field) => examObservations[field]?.value === true && !knownFields.has(field)
    );

    const displayExamMigrationWarning = unmatchedExamFields.length > 0;

    return { unmatchedExamFields, displayExamMigrationWarning };
  }, [knownFields, examObservations]);

  const hasIncompatibleExamConfig = useMemo(() => {
    const telemedAppt = isTelemedAppointment(appointment);
    const legacyExamVersion = encounterHasLegacyExamVersion(encounter);

    const appointmentLocked = appointment ? isAppointmentLocked(appointment) : false;

    return telemedAppt && legacyExamVersion && appointmentLocked;
  }, [appointment, encounter]);

  return {
    unmatchedExamFields,
    displayExamMigrationWarning,
    hasIncompatibleExamConfig,
  };
}
