import { FRIENDLY_PATIENT_ID_SYSTEM_BASE } from 'utils/lib/fhir/constants';

export const getFriendlyPatientIdSystem = (): string | undefined => {
  const projectId = import.meta.env.VITE_APP_PROJECT_ID;
  return projectId ? `${FRIENDLY_PATIENT_ID_SYSTEM_BASE}/${projectId}` : undefined;
};
