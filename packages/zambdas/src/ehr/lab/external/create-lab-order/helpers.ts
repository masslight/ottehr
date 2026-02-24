import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  Coding,
  Communication,
  Coverage,
  Encounter,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateLabPaymentMethod,
  DiagnosisDTO,
  FHIR_IDC10_VALUESET_SYSTEM,
  getFullestAvailableName,
  LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY,
  LAB_ORDER_TASK,
  LabPaymentMethod,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  PSC_HOLD_CONFIG,
} from 'utils';
import { createTask } from '../../../../shared/tasks';

export type CreateLabCoverageDetails =
  | { type: LabPaymentMethod.Insurance; insuranceCoverages: Coverage[] }
  | { type: LabPaymentMethod.ClientBill; clientBillCoverage: Coverage | undefined; clientOrg: Organization }
  | { type: LabPaymentMethod.SelfPay }
  | { type: LabPaymentMethod.WorkersComp; workersCompInsurance: Coverage };

type TestsByLabGuid = {
  [labGuid: string]: {
    tests: OrderableItemSearchResult[];
    labName: string;
  };
};

export type GetCreateOrderResourcesInput = {
  encounter: Encounter;
  psc: boolean;
  selectedPaymentMethod: CreateLabPaymentMethod;
  oystehr: Oystehr;
  modifiedOrderingLocation: ModifiedOrderingLocation;
  clientOrgId: string;
  labName: string;
  labGuid: string;
};

export type GetCreateOrderResourcesReturn = {
  labOrganization: Organization;
  patient: Patient;
  coverageDetails: CreateLabCoverageDetails;
  existingOrderNumber: string | undefined;
  orderingLocation: Location;
  orderLevelNote: Communication | undefined;
};

export type ResourcesForRequestFormatting = Omit<GetCreateOrderResourcesReturn, 'existingOrderNumber'> & {
  requisitionNumber: string;
  encounter: Encounter;
  selectedPaymentMethod: CreateLabPaymentMethod;
  dx: DiagnosisDTO[];
  psc: boolean;
  attendingPractitionerId: string;
  currentUserPractitioner: Practitioner;
  clinicalInfoNoteByUser: string | undefined;
};

export const groupTestsByLabGuid = (orderableItems: OrderableItemSearchResult[]): TestsByLabGuid => {
  const testsGroupedByLabGuid: TestsByLabGuid = {};
  orderableItems.forEach((oi) => {
    const labGuid = oi.lab.labGuid;

    if (testsGroupedByLabGuid[labGuid]) {
      testsGroupedByLabGuid[labGuid].tests.push(oi);
    } else {
      const value = {
        tests: [oi],
        labName: oi.lab.labName,
      };
      testsGroupedByLabGuid[labGuid] = value;
    }
  });

  return testsGroupedByLabGuid;
};

export const formatClinicalInfoNoteCommunication = (
  requisitionNumber: string,
  serviceRequestFullUrl: string,
  clinicalInfoNoteByUser: string
): Communication => {
  console.log('adding request to create a communication resources for clinical info notes');
  const communicationConfig: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    identifier: [
      {
        system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
        value: requisitionNumber,
      },
    ],
    basedOn: [{ reference: serviceRequestFullUrl }],
    category: [
      {
        coding: [LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY],
      },
    ],
    payload: [{ contentString: clinicalInfoNoteByUser }],
  };
  return communicationConfig;
};

export const formatServiceRequestConfig = (
  orderableItem: OrderableItemSearchResult,
  resources: ResourcesForRequestFormatting,
  serviceRequestContained: FhirResource[],
  containedActivityDefinitionId: string,
  specimenFullUrlArr: string[],
  provenanceFullUrl: string
): ServiceRequest => {
  const { labOrganization, patient, orderingLocation, requisitionNumber, encounter, psc, dx, attendingPractitionerId } =
    resources;

  const serviceRequestCode = formatSrCode(orderableItem);
  const serviceRequestReasonCode: ServiceRequest['reasonCode'] = dx.map((diagnosis) => {
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
  });

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
    performer: [
      {
        reference: `Organization/${labOrganization.id}`,
        identifier: {
          system: OYSTEHR_LAB_GUID_SYSTEM,
          value: labOrganization.identifier?.find((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)?.value,
        },
      },
    ],
    authoredOn: DateTime.now().toISO() || undefined,
    priority: 'stat',
    code: serviceRequestCode,
    reasonCode: serviceRequestReasonCode,
    instantiatesCanonical: [`#${containedActivityDefinitionId}`],
    contained: serviceRequestContained,
    identifier: [
      {
        system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
        value: requisitionNumber,
      },
    ],
    locationReference: [
      {
        type: 'Location',
        reference: `Location/${orderingLocation.id}`,
      },
    ],
    relevantHistory: [
      {
        reference: provenanceFullUrl,
      },
    ],
  };

  if (specimenFullUrlArr.length > 0) {
    serviceRequestConfig.specimen = specimenFullUrlArr.map((url) => ({
      type: 'Specimen',
      reference: url,
    }));
  }

  if (psc) {
    serviceRequestConfig.orderDetail = [
      {
        coding: [
          {
            system: PSC_HOLD_CONFIG.system,
            code: PSC_HOLD_CONFIG.code,
            display: PSC_HOLD_CONFIG.display,
          },
        ],
        text: PSC_HOLD_CONFIG.display,
      },
    ];
  }

  return serviceRequestConfig;
};

const formatSrCode = (orderableItem: OrderableItemSearchResult): ServiceRequest['code'] => {
  const coding: Coding[] = [
    {
      system: OYSTEHR_LAB_OI_CODE_SYSTEM,
      code: orderableItem.item.itemCode,
      display: orderableItem.item.itemName,
    },
  ];
  if (orderableItem.item.itemLoinc) {
    coding.push({
      system: 'http://loinc.org',
      code: orderableItem.item.itemLoinc,
    });
  }
  return {
    coding,
    text: orderableItem.item.itemName,
  };
};

export const formatPreSubmissionTaskConfig = (
  resources: ResourcesForRequestFormatting,
  testActivityDefinition: ActivityDefinition,
  serviceRequestFullUrl: string,
  serviceRequestConfig: ServiceRequest
): Task => {
  const { encounter, orderingLocation, patient, labOrganization, currentUserPractitioner } = resources;
  const patientName = getFullestAvailableName(patient);
  const testName = testActivityDefinition.name;
  const labName = labOrganization.name;
  const fullTestName = testName + (labName ? ' / ' + labName : '');

  const preSubmissionTaskConfig = createTask({
    category: LAB_ORDER_TASK.category,
    title: `Collect sample for “${fullTestName}” for ${patientName}`,
    code: {
      system: LAB_ORDER_TASK.system,
      code: LAB_ORDER_TASK.code.preSubmission,
    },
    encounterId: encounter.id ?? '',
    location: orderingLocation.id
      ? {
          id: orderingLocation.id,
        }
      : undefined,
    basedOn: [serviceRequestFullUrl],
    input: [
      {
        type: LAB_ORDER_TASK.input.testName,
        valueString: testName,
      },
      {
        type: LAB_ORDER_TASK.input.labName,
        valueString: labOrganization.name,
      },
      {
        type: LAB_ORDER_TASK.input.patientName,
        valueString: patientName,
      },
      {
        type: LAB_ORDER_TASK.input.providerName,
        valueString: getFullestAvailableName(currentUserPractitioner),
      },
      {
        type: LAB_ORDER_TASK.input.orderDate,
        valueString: serviceRequestConfig.authoredOn,
      },
      {
        type: LAB_ORDER_TASK.input.appointmentId,
        valueString: encounter.appointment?.[0]?.reference?.split('/')?.[1],
      },
    ],
  });

  return preSubmissionTaskConfig;
};
