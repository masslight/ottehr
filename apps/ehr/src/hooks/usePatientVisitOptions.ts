import { useMemo } from 'react';
import { useGetPatientVisitHistory } from './useGetPatientVisitHistory';

export type PatientVisitOption = {
  encounterId: string;
  appointmentId: string | undefined;
  dateTime: string | undefined;
};

export type UsePatientVisitOptionsReturn = {
  isLoading: boolean;
  visitOptions: PatientVisitOption[];
  visitsByEncounterId: Map<string, PatientVisitOption>;
  /**
   * Needed alongside the encounter lookup because intake paperwork links documents to the
   * Appointment rather than the Encounter, so a document may only know its appointment id.
   */
  visitsByAppointmentId: Map<string, PatientVisitOption>;
};

/**
 * The patient's visits, flattened for use as document-filter options and for labelling the "Visit"
 * column. Follow-up encounters are included: they are visits in their own right and documents can be
 * filed against them.
 */
export const usePatientVisitOptions = (patientId: string | undefined): UsePatientVisitOptionsReturn => {
  const { data, isLoading } = useGetPatientVisitHistory(patientId);

  const visitOptions = useMemo<PatientVisitOption[]>(() => {
    const options = new Map<string, PatientVisitOption>();

    for (const visit of data?.visits ?? []) {
      if (visit.encounterId) {
        options.set(visit.encounterId, {
          encounterId: visit.encounterId,
          appointmentId: visit.appointmentId,
          dateTime: visit.dateTime,
        });
      }
      for (const followUp of visit.followUps ?? []) {
        if (!followUp.encounterId || options.has(followUp.encounterId)) continue;
        options.set(followUp.encounterId, {
          encounterId: followUp.encounterId,
          appointmentId: followUp.appointmentId ?? followUp.originalAppointmentId,
          dateTime: followUp.dateTime,
        });
      }
    }

    return Array.from(options.values()).sort((a, b) => (b.dateTime ?? '').localeCompare(a.dateTime ?? ''));
  }, [data]);

  const visitsByEncounterId = useMemo(
    () => new Map(visitOptions.map((option) => [option.encounterId, option])),
    [visitOptions]
  );

  const visitsByAppointmentId = useMemo(
    () =>
      new Map(
        visitOptions
          .filter((option): option is PatientVisitOption & { appointmentId: string } => !!option.appointmentId)
          .map((option) => [option.appointmentId, option])
      ),
    [visitOptions]
  );

  return { isLoading, visitOptions, visitsByEncounterId, visitsByAppointmentId };
};
