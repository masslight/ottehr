import {
  ChartDataWithResources,
  createCodingCode,
  createReference,
  DispositionFollowUpType,
  DispositionMetaFieldsNames,
  GetChartDataResponse,
  SaveChartDataResponse,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import {
  AuditEvent,
  AuditEventEntity,
  Bundle,
  CodeableConcept,
  Coding,
  Encounter,
  FhirResource,
  Resource,
  ServiceRequest,
} from 'fhir/r4b';
import { parseCreatedResourcesBundle } from '../shared';
import {
  chartDataResourceHasMetaTagByCode,
  handleCustomDTOExtractions,
  mapResourceToChartDataResponse,
} from '../shared/chart-data/chart-data-helpers';
import { DateTime } from 'luxon';
import { createAuditEventEntity, VersionEntity } from 'utils/lib/helpers/resources';
import {
  CHART_DATA_PATIENT_LOGS_AUDIT_EVENT_CODE,
  CHART_DATA_PATIENT_LOGS_AUDIT_EVENT_SYSTEM,
} from 'utils/lib/types/api/audit-event.constants';

export const validateBundleAndExtractSavedChartData = (
  bundle: Bundle,
  patientId: string,
  encounterId: string,
  additionResourcesForResponse: FhirResource[]
): ChartDataWithResources => {
  let chartDataResponse: GetChartDataResponse = {
    patientId,
    procedures: [],
    medications: [],
    conditions: [],
    allergies: [],
    examObservations: [],
    cptCodes: [],
    instructions: [],
    diagnosis: [],
    episodeOfCare: [],
    schoolWorkNotes: [],
    observations: [],
    prescribedMedications: [],
    notes: [],
    vitalsObservations: [],
    birthHistory: [],
  };

  let resources = parseCreatedResourcesBundle(bundle);
  resources = resources.concat(additionResourcesForResponse);

  console.log('Bundle parsed');

  let chartDataResources: Resource[] = [];
  resources.forEach((resource) => {
    const updatedChartData = mapResourceToChartDataResponse(chartDataResponse, resource, encounterId);
    chartDataResponse = updatedChartData.chartDataResponse;
    if (updatedChartData.resourceMapped) chartDataResources.push(resource);
  });

  console.log('Resources mapped to regular chart data fields');

  const customExtractions = handleCustomDTOExtractions(chartDataResponse, resources);
  chartDataResponse = customExtractions.chartData as GetChartDataResponse;
  if (customExtractions.chartResources)
    chartDataResources = chartDataResources.concat(customExtractions.chartResources);

  console.log('Custom dto extractions happened');

  return {
    chartData: chartDataResponse,
    chartResources: chartDataResources,
  };
};

export const followUpToPerformerMap: { [field in DispositionFollowUpType]: CodeableConcept | undefined } = {
  dentistry: createCodingCode('106289002', 'Dentist', 'http://snomed.info/sct'),
  ent: createCodingCode('309372007', 'Ear, nose and throat surgeon', 'http://snomed.info/sct'),
  ophthalmology: createCodingCode('422234006', 'Ophthalmologist (occupation)', 'http://snomed.info/sct'),
  orthopedics: createCodingCode('59169001', 'Orthopedic technician', 'http://snomed.info/sct'),
  'lurie-ct': createCodingCode('lurie-ct', undefined, 'lurie-ct'),
  other: createCodingCode('other', 'other'),
};

export async function getEncounterAndRelatedResources(oystehr: Oystehr, encounterId?: string): Promise<Resource[]> {
  if (!encounterId) {
    throw new Error('Encounter ID is required');
  }
  return (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_revinclude:iterate',
          value: 'ServiceRequest:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'DocumentReference:encounter',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_revinclude:iterate',
          value: 'List:patient',
        },
      ],
    })
  ).unbundle();
}

export function filterServiceRequestsFromFhir(
  allResources: Resource[],
  metaTag?: DispositionMetaFieldsNames,
  performer?: Coding
): ServiceRequest[] {
  return allResources.filter((resource) => {
    if (!(resource.resourceType === 'ServiceRequest')) return false;
    const serviceRequest = resource as ServiceRequest;

    let resultBoolean = true;
    if (metaTag) resultBoolean = resultBoolean && Boolean(chartDataResourceHasMetaTagByCode(resource, metaTag));
    if (performer) resultBoolean = resultBoolean && findCodingInCode(serviceRequest.performerType, performer);
    return resultBoolean;
  }) as ServiceRequest[];
}

function findCodingInCode(code: CodeableConcept | undefined, coding: Coding): boolean {
  return Boolean(
    code?.coding?.find((element) => {
      return element.code === coding.code && element.system === coding.system;
    })
  );
}

export function createAuditEvent(providerId: string, patientId: string, versionEntities: VersionEntity[]): AuditEvent {
  const resourcesEntities: AuditEventEntity[] = [];

  versionEntities.forEach((versionEntity) => {
    resourcesEntities.push(createAuditEventEntity(versionEntity));
  });
  return {
    resourceType: 'AuditEvent',
    type: {
      code: '110101',
      system: 'http://dicom.nema.org/resources/ontology/DCM',
      display: 'Audit Log Used\t',
    },
    subtype: [
      {
        code: CHART_DATA_PATIENT_LOGS_AUDIT_EVENT_CODE,
        system: CHART_DATA_PATIENT_LOGS_AUDIT_EVENT_SYSTEM,
      },
    ],
    agent: [
      {
        who: {
          reference: `Practitioner/${providerId}`,
        },
        requestor: true,
      },
      {
        who: {
          reference: `Patient/${patientId}`,
        },
        requestor: false,
      },
    ],
    recorded: DateTime.now().toISO() ?? '',
    source: {
      observer: {
        reference: `Practitioner/${providerId}`,
      },
    },
    entity: resourcesEntities,
  };
}

export function createVersionEntitiesForChartResources(
  oldResources: Resource[],
  newResources: Resource[]
): VersionEntity[] {
  // this function is basically for merging old resources and new ones into one array
  // with entities that contains old and new versions of resource
  const resultEntities: { [key: string]: VersionEntity } = {};

  oldResources.forEach((res) => {
    const reference = createReference(res);
    const versionId = res.meta?.versionId;
    if (res.id && versionId) {
      resultEntities[res.id] = {
        resourceReference: reference,
        name: 'name',
        previousVersionId: versionId,
      };
    }
  });

  newResources.forEach((res) => {
    const reference = createReference(res);
    const versionId = res.meta?.versionId;
    if (res.id) {
      resultEntities[res.id] = {
        resourceReference: reference,
        name: 'name',
        newVersionId: versionId,
      };
    }
  });

  const resultKeys = Object.keys(resultEntities);
  return resultKeys.map((key) => resultEntities[key]);
}
