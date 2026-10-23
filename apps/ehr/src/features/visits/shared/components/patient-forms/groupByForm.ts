import { PatientFormResponse } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

// Compares instants, not strings: visit dates carry their location's UTC offset.
const visitTime = (r: PatientFormResponse): number => (r.visitDate ? Date.parse(r.visitDate) : 0) || 0;

/** Groups responses by form; groups with the most recent response first, responses newest first. */
export const groupByForm = (responses: PatientFormResponse[]): PatientFormResponse[][] => {
  const groups = new Map<string, PatientFormResponse[]>();
  [...responses]
    .sort((a, b) => visitTime(b) - visitTime(a))
    .forEach((r) => {
      const key = r.questionnaireUrl ?? r.questionnaireTitle;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    });
  return [...groups.values()];
};
