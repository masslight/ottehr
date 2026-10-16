import Oystehr from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';

interface EncounterResourceOptions {
  includeChartData?: boolean;
  includeProcedureDependencies?: boolean;
}

export async function getEncounterAndRelatedResources(
  oystehr: Oystehr,
  encounterId?: string,
  { includeChartData = false, includeProcedureDependencies = false }: EncounterResourceOptions = {}
): Promise<FhirResource[]> {
  if (!encounterId) throw new Error('Encounter ID is required');
  const searchParams = {
    resourceType: 'Encounter' as const,
    params: [
      { name: '_id', value: encounterId },
      { name: '_include', value: 'Encounter:subject' },
      { name: '_include', value: 'Encounter:appointment' },
      { name: '_revinclude:iterate', value: 'ServiceRequest:encounter' },
      { name: '_revinclude:iterate', value: 'DocumentReference:encounter' },
      ...(includeChartData || includeProcedureDependencies
        ? [
            { name: '_include', value: 'Encounter:location' },
            { name: '_revinclude:iterate', value: 'List:patient' },
            { name: '_revinclude:iterate', value: 'Condition:encounter' },
            { name: '_revinclude:iterate', value: 'Observation:encounter' },
            { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
          ]
        : []),
      ...(includeProcedureDependencies
        ? [
            { name: '_revinclude:iterate', value: 'MedicationRequest:encounter' },
            { name: '_revinclude:iterate', value: 'MedicationAdministration:context' },
          ]
        : []),
    ],
  };
  if (includeProcedureDependencies) return getAllFhirSearchPages<FhirResource>(searchParams, oystehr);
  return (await oystehr.fhir.search<FhirResource>(searchParams)).unbundle();
}
