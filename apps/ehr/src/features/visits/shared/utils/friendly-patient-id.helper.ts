import { Patient } from 'fhir/r4b';
import { FRIENDLY_PATIENT_ID_SYSTEM_BASE } from 'utils';

export function getFriendlyPatientId(patient: Patient): string {
  const system = getFriendlyPatientIdSystem();
  return patient.identifier?.find((ident) => ident.system === system)?.value ?? '';
}

export const getFriendlyPatientIdSystem = (): string | undefined => {
  const projectId = import.meta.env.VITE_APP_PROJECT_ID;
  return projectId ? `${FRIENDLY_PATIENT_ID_SYSTEM_BASE}/${projectId}` : undefined;
};
