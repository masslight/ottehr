// The patient delete-cascade: every FHIR resource type the synth pipeline writes
// for a Patient, with the search param that binds it to the patient, ordered
// innermost-first to minimise dependency-conflict 409s on delete.
//
// Single source of truth shared by cleanup-synth-patient.ts (walks tier by tier)
// and cleanup-test-patients.ts (flattens the tiers into one related-resource
// sweep). Previously each script kept its own list and they drifted —
// cleanup-test-patients was missing ServiceRequest, DiagnosticReport, Task,
// DocumentReference, Account, and more.
import type { FhirResource } from 'fhir/r4b';

export type ResourceTypeName = FhirResource['resourceType'];

export interface CascadeEntry {
  rt: ResourceTypeName;
  param: 'patient' | 'subject' | 'beneficiary';
}

export const PATIENT_CASCADE_TIERS: CascadeEntry[][] = [
  // 1. Leaf resources (referenced from Encounter/Patient but not by other writable rows)
  [
    { rt: 'Communication', param: 'subject' },
    { rt: 'MedicationAdministration', param: 'subject' },
    { rt: 'MedicationRequest', param: 'subject' },
    { rt: 'DiagnosticReport', param: 'subject' },
    { rt: 'Immunization', param: 'patient' },
    { rt: 'Task', param: 'patient' },
    { rt: 'ServiceRequest', param: 'subject' },
  ],
  // 2. Mid-tier patient-bound clinical data
  [
    { rt: 'Procedure', param: 'subject' },
    { rt: 'Observation', param: 'subject' },
    { rt: 'Condition', param: 'subject' },
    { rt: 'MedicationStatement', param: 'subject' },
    { rt: 'AllergyIntolerance', param: 'patient' },
    { rt: 'EpisodeOfCare', param: 'patient' },
    { rt: 'ImagingStudy', param: 'subject' },
  ],
  // 3. Document attachments + their containers
  [
    { rt: 'DocumentReference', param: 'subject' },
    { rt: 'List', param: 'subject' },
  ],
  // 4. Coverage / billing surface
  [
    { rt: 'CoverageEligibilityRequest', param: 'patient' },
    { rt: 'CoverageEligibilityResponse', param: 'patient' },
    { rt: 'Coverage', param: 'beneficiary' },
    { rt: 'Account', param: 'subject' },
    { rt: 'RelatedPerson', param: 'patient' },
  ],
  // 5. Visit container resources
  [
    { rt: 'Encounter', param: 'patient' },
    { rt: 'Appointment', param: 'patient' },
    { rt: 'QuestionnaireResponse', param: 'subject' },
  ],
];
