import Oystehr, { BatchInputDeleteRequest, FhirSearchParams } from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, FhirResource, Patient, Person, RelatedPerson } from 'fhir/r4b';

export const deletePatientData = async (oystehr: Oystehr, patientId: string): Promise<number> => {
  const allResources = await getPatientAndResourcesById(oystehr, patientId);
  if (allResources.length === 0) {
    return 0;
  }
  const deleteRequests = generateDeleteRequests(allResources);

  try {
    console.log(
      'Deleting resources:',
      deleteRequests.map((request) => request.url.slice(1).replace('/', ': '))
    );
    await oystehr.fhir.batch({ requests: [...deleteRequests] });
  } catch (e) {
    console.log(`Error deleting resources: ${e}`, JSON.stringify(e));
  } finally {
    console.log(`Deleting resources complete`);
  }
  return deleteRequests.filter((request) => request.url.startsWith('/Patient')).length;
};

const generateDeleteRequests = (allResources: FhirResource[]): BatchInputDeleteRequest[] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];

  const patients = allResources.filter((resourceTemp) => resourceTemp.resourceType === 'Patient') as Patient[];
  patients.forEach((patientTemp) => {
    if (!patientTemp.id) {
      return;
    }
    deleteRequests.push({ method: 'DELETE', url: `/Patient/${patientTemp.id}` });
  });

  const relatedPersons = allResources.filter(
    (resourceTemp) => resourceTemp.resourceType === 'RelatedPerson'
  ) as RelatedPerson[];
  relatedPersons.forEach((relatedPersonTemp) => {
    if (!relatedPersonTemp.id) {
      return;
    }
    deleteRequests.push({ method: 'DELETE', url: `/RelatedPerson/${relatedPersonTemp.id}` });
  });

  const documentReferences = allResources.filter(
    (resourceTemp) => resourceTemp.resourceType === 'DocumentReference'
  ) as DocumentReference[];
  documentReferences.forEach((documentReferenceTemp) => {
    if (!documentReferenceTemp.id) {
      return;
    }
    deleteRequests.push({ method: 'DELETE', url: `/DocumentReference/${documentReferenceTemp.id}` });
  });

  return deleteRequests;
};

const getPatientAndResourcesById = async (oystehr: Oystehr, patientId: string): Promise<FhirResource[]> => {
  const fhirSearchParams: FhirSearchParams<
    DocumentReference | Patient | RelatedPerson | Person | Appointment | Encounter
  > = {
    resourceType: 'Patient',
    params: [
      {
        name: '_id',
        value: patientId,
      },
      {
        name: '_revinclude:iterate',
        value: 'DocumentReference:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Person:relatedperson',
      },
      // sanity checking these don't exist
      {
        name: '_revinclude:iterate',
        value: 'Appointment:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:patient',
      },
    ],
  };

  const allResources = (await oystehr.fhir.search(fhirSearchParams)).unbundle();

  // if an appointment or an encounter exists, we're not deleting this patient
  if (
    allResources.some((resource) => resource.resourceType === 'Appointment' || resource.resourceType === 'Encounter')
  ) {
    return [];
  }

  return allResources;
};
