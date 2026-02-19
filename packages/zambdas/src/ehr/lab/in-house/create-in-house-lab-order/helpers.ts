import { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  ActivityDefinition,
  Coverage,
  Encounter,
  Location,
  Patient,
  Procedure,
  Provenance,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CODE_SYSTEM_CPT,
  DiagnosisDTO,
  EXTENSION_URL_CPT_MODIFIER,
  FHIR_IDC10_VALUESET_SYSTEM,
  getFullestAvailableName,
  IN_HOUSE_LAB_TASK,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  REFLEX_TEST_ORDER_DETAIL_TAG_CONFIG,
} from 'utils';
import { fillMeta, makeCptModifierExtension } from '../../../../shared';
import { createTask } from '../../../../shared/tasks';

export interface TestItemRequestData {
  activityDefinition: ActivityDefinition;
  serviceRequests: ServiceRequest[] | undefined;
  orderedAsRepeat: boolean;
  parentTestCanonicalUrl: string | undefined; // indicates this test is being run as reflex
}

export interface TestItemResources {
  activityDefinition: ActivityDefinition;
  initialServiceRequest: ServiceRequest | undefined;
  testDetailType: 'reflex' | 'repeat' | undefined;
}

export interface CreateInHouseLabResources {
  diagnosesAll: DiagnosisDTO[];
  notes: string | undefined;
  testResources: TestItemResources[];
  encounter: Encounter;
  patient: Patient;
  coverage: Coverage | undefined;
  location: Location | undefined;
  currentUserPractitionerName: string | undefined;
  currentUserPractitionerId: string;
  attendingPractitionerName: string | undefined;
  attendingPractitionerId: string;
}

export const makeRequestsForCreateInHouseLabs = (
  resources: CreateInHouseLabResources
): BatchInputPostRequest<ServiceRequest | Task | Provenance | Procedure>[] => {
  const { testResources } = resources;

  const requests: BatchInputPostRequest<ServiceRequest | Task | Provenance | Procedure>[] = [];

  testResources.forEach((testData) => {
    const { activityDefinition, testDetailType } = testData;

    const serviceRequestFullUrl = `urn:uuid:${randomUUID()}`;
    const serviceRequestConfig = makeServiceRequestConfig(resources, testData);

    const taskConfig = makeTaskConfig(
      resources,
      activityDefinition,
      serviceRequestConfig.authoredOn,
      serviceRequestFullUrl
    );

    const provenanceConfig = makeProvenanceConfig(resources, serviceRequestFullUrl);

    const procedureConfig = makeProcedureConfig(resources, activityDefinition, testDetailType);

    requests.push(
      {
        method: 'POST',
        url: '/ServiceRequest',
        resource: serviceRequestConfig,
        fullUrl: serviceRequestFullUrl,
      },
      {
        method: 'POST',
        url: '/Task',
        resource: taskConfig,
      },
      {
        method: 'POST',
        url: '/Provenance',
        resource: provenanceConfig,
      },
      {
        method: 'POST',
        url: '/Procedure',
        resource: procedureConfig,
      }
    );
  });

  return requests;
};

const makeServiceRequestConfig = (
  resources: CreateInHouseLabResources,
  testData: TestItemResources
): ServiceRequest => {
  const { diagnosesAll, notes, encounter, patient, coverage, location, attendingPractitionerId } = resources;
  const { activityDefinition, initialServiceRequest, testDetailType } = testData;

  const serviceRequestConfig: ServiceRequest = {
    resourceType: 'ServiceRequest',
    status: 'draft',
    intent: 'order',
    subject: {
      reference: `Patient/${patient.id}`,
    },
    encounter: {
      reference: `Encounter/${encounter.id}`,
    },
    requester: {
      reference: `Practitioner/${attendingPractitionerId}`,
    },
    authoredOn: DateTime.now().toISO() || undefined,
    priority: 'stat',
    code: {
      coding: activityDefinition.code?.coding,
      text: activityDefinition.name,
    },
    reasonCode: [...diagnosesAll].map((diagnosis) => {
      return {
        coding: [
          {
            system: FHIR_IDC10_VALUESET_SYSTEM,
            code: diagnosis?.code,
            display: diagnosis?.display,
          },
        ],
        text: diagnosis?.display,
      };
    }),
    ...(location && {
      locationReference: [
        {
          type: 'Location',
          reference: `Location/${location.id}`,
        },
      ],
    }),
    ...(notes && { note: [{ text: notes }] }),
    ...(coverage && { insurance: [{ reference: `Coverage/${coverage.id}` }] }),
    instantiatesCanonical: [`${activityDefinition.url}|${activityDefinition.version}`],
  };

  // if an initialServiceRequest is defined, the test being ordered is repeat OR reflex and should be linked to the
  // original test represented by initialServiceRequest
  if (initialServiceRequest) {
    serviceRequestConfig.basedOn = [
      {
        reference: `ServiceRequest/${initialServiceRequest.id}`,
      },
    ];
  }

  if (testDetailType === 'reflex') {
    serviceRequestConfig.meta = { tag: [REFLEX_TEST_ORDER_DETAIL_TAG_CONFIG] };
  }

  return serviceRequestConfig;
};

const makeTaskConfig = (
  resources: CreateInHouseLabResources,
  activityDefinition: ActivityDefinition,
  serviceRequestConfigAuthoredOn: string | undefined,
  serviceRequestFullUrl: string
): Task => {
  const { encounter, patient, location, currentUserPractitionerName } = resources;

  const patientName = getFullestAvailableName(patient);

  const taskConfig = createTask({
    category: IN_HOUSE_LAB_TASK.category,
    title: `Collect sample for “${activityDefinition.name}” for ${patientName}`,
    code: {
      system: IN_HOUSE_LAB_TASK.system,
      code: IN_HOUSE_LAB_TASK.code.collectSampleTask,
    },
    encounterId: encounter.id,
    location: location?.id
      ? {
          id: location.id,
        }
      : undefined,
    input: [
      {
        type: IN_HOUSE_LAB_TASK.input.testName,
        valueString: activityDefinition.name,
      },
      {
        type: IN_HOUSE_LAB_TASK.input.patientName,
        valueString: patientName,
      },
      {
        type: IN_HOUSE_LAB_TASK.input.providerName,
        valueString: currentUserPractitionerName ?? 'Unknown',
      },
      {
        type: IN_HOUSE_LAB_TASK.input.orderDate,
        valueString: serviceRequestConfigAuthoredOn,
      },
      {
        type: IN_HOUSE_LAB_TASK.input.appointmentId,
        valueString: encounter.appointment?.[0]?.reference?.split('/')?.[1],
      },
    ],
    basedOn: [serviceRequestFullUrl],
  });

  return taskConfig;
};

const makeProvenanceConfig = (resources: CreateInHouseLabResources, serviceRequestFullUrl: string): Provenance => {
  const {
    location,
    currentUserPractitionerName,
    currentUserPractitionerId,
    attendingPractitionerName,
    attendingPractitionerId,
  } = resources;

  const provenanceConfig: Provenance = {
    resourceType: 'Provenance',
    activity: {
      coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
    },
    target: [{ reference: serviceRequestFullUrl }],
    ...(location && { location: { reference: `Location/${location.id}` } }),
    recorded: DateTime.now().toISO(),
    agent: [
      {
        who: {
          reference: `Practitioner/${currentUserPractitionerId}`,
          display: currentUserPractitionerName,
        },
        onBehalfOf: {
          reference: `Practitioner/${attendingPractitionerId}`,
          display: attendingPractitionerName,
        },
      },
    ],
  };

  return provenanceConfig;
};

const makeProcedureConfig = (
  resources: CreateInHouseLabResources,
  activityDefinition: ActivityDefinition,
  testDetailType: TestItemResources['testDetailType']
): Procedure => {
  const { encounter, patient, attendingPractitionerId } = resources;

  let procedureCodeExtension = {};

  if (testDetailType === 'repeat') {
    // this logic will cover if we add a test that is repeatable and has an extra modifier on it
    // otherwise it will be spread below
    const additionalModifierExt =
      activityDefinition.code?.coding
        ?.find((coding) => coding.system === CODE_SYSTEM_CPT)
        ?.extension?.filter((ext) => ext.url === EXTENSION_URL_CPT_MODIFIER && ext.valueCodeableConcept) ?? [];

    const repeatModifier = makeCptModifierExtension([
      { code: '91', display: 'Repeat Clinical Diagnostic Laboratory Test' },
    ]);
    procedureCodeExtension = { extension: [repeatModifier, ...additionalModifierExt] };
  }

  const procedureConfig: Procedure = {
    resourceType: 'Procedure',
    status: 'completed',
    subject: {
      reference: `Patient/${patient.id}`,
    },
    encounter: {
      reference: `Encounter/${encounter.id}`,
    },
    performer: [
      {
        actor: {
          reference: `Practitioner/${attendingPractitionerId}`,
        },
      },
    ],
    code: {
      coding: [
        {
          ...activityDefinition.code?.coding?.find((coding) => coding.system === CODE_SYSTEM_CPT),
          display: activityDefinition.name,
          ...procedureCodeExtension,
        },
      ],
    },
    meta: fillMeta('cpt-code', 'cpt-code'), // This is necessary to get the Assessment part of the chart showing the CPT codes. It is some kind of save-chart-data feature that this meta is used to find and save the CPT codes instead of just looking at the FHIR Procedure resources code values.
  };

  return procedureConfig;
};
