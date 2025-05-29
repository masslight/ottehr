import { DiagnosisDTO } from '../../api/chart-data/chart-data.types';

export const getFormattedDiagnoses = (diagnoses: DiagnosisDTO[]): string => {
  return diagnoses.map((d) => `${d.code} ${d.display}`).join(', ');
};
