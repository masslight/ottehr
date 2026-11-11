import { PatientFormResponse } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

// Compares instants, not strings: visit dates carry their location's UTC offset.
const visitTime = (r: PatientFormResponse): number => (r.visitDate ? Date.parse(r.visitDate) : 0) || 0;

/** Groups responses by form; groups with the most recent response first, responses newest first. */
export const groupByForm = (responses: PatientFormResponse[]): PatientFormResponse[][] => {
  const groups = [...responses]
    .sort((a, b) => visitTime(b) - visitTime(a))
    .reduce((byForm, r) => {
      const key = r.questionnaireUrl ?? r.questionnaireTitle;
      return byForm.set(key, [...(byForm.get(key) ?? []), r]);
    }, new Map<string, PatientFormResponse[]>());
  return [...groups.values()];
};
