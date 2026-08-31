/**
 * FHIR search parameters for fetching complete appointment graph with all related resources.
 * Used by seed data generation and integration tests to ensure consistent data fetching.
 */
export const E2E_APPOINTMENT_GRAPH_SEARCH_PARAMS = [
  { name: '_include', value: 'Appointment:patient' },
  { name: '_include', value: 'Appointment:slot' },
  { name: '_include', value: 'Appointment:location' },
  { name: '_revinclude:iterate', value: 'RelatedPerson:patient' },
  { name: '_revinclude:iterate', value: 'Encounter:appointment' },
  { name: '_revinclude:iterate', value: 'DocumentReference:patient' },
  { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
  { name: '_revinclude:iterate', value: 'Person:relatedperson' },
  { name: '_revinclude:iterate', value: 'List:subject' },
  { name: '_revinclude:iterate', value: 'Consent:patient' },
  { name: '_revinclude:iterate', value: 'Account:patient' },
  { name: '_include:iterate', value: 'Account:owner' },
  { name: '_revinclude:iterate', value: 'Observation:encounter' },
  { name: '_revinclude:iterate', value: 'ServiceRequest:encounter' },
  { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
] as const;

/**
 * Get FHIR search parameters for fetching appointment graph with a specific appointment ID
 */
export const getAppointmentGraphSearchParams = (
  appointmentId: string
): [{ name: '_id'; value: string }, ...typeof E2E_APPOINTMENT_GRAPH_SEARCH_PARAMS] => {
  return [{ name: '_id', value: appointmentId }, ...E2E_APPOINTMENT_GRAPH_SEARCH_PARAMS] as const;
};
