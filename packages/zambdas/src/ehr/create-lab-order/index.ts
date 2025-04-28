import { APIGatewayProxyResult } from 'aws-lambda';
import {
  OrderableItemSearchResult,
  PSC_HOLD_CONFIG,
  LAB_ORDER_TASK,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  FHIR_IDC10_VALUESET_SYSTEM,
  flattenBundleResources,
  PRACTITIONER_CODINGS,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
} from 'utils';
import { validateRequestParameters } from './validateRequestParameters';
import {
  Encounter,
  Location,
  ServiceRequest,
  QuestionnaireResponse,
  Task,
  Organization,
  Coding,
  FhirResource,
  Coverage,
  ActivityDefinition,
  Patient,
  Account,
  Provenance,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { createOystehrClient } from '../../shared/helpers';
import { checkOrCreateM2MClientToken, topLevelCatch } from '../../shared';
import { ZambdaInput } from '../../shared/types';
import { getPrimaryInsurance } from '../shared/labs';
import { getMyPractitionerId } from '../../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { dx, encounter, orderableItem, psc, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    let curUserPractitionerId: string | undefined;
    try {
      curUserPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    } catch (e) {
      throw new Error('User creating this lab order must have a Practitioner resource linked');
    }
    const attendingPractitionerId = encounter.participant
      ?.find(
        (participant) =>
          participant.type?.find(
            (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
          )
      )
      ?.individual?.reference?.replace('Practitioner/', '');
    if (!attendingPractitionerId) {
      // this should never happen since theres also a validation on the front end that you cannot submit without one
      throw new Error('This encounter does not have an attending practitioner linked');
    }

    console.log('encounter id', encounter.id);
    const { labOrganization, coverage, location, patientId } = await getAdditionalResources(
      orderableItem,
      encounter,
      oystehr
    );

    const activityDefinitionToContain = formatActivityDefinitionToContain(orderableItem);

    const requests: BatchInputRequest<FhirResource>[] = [];

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
        reference: `Patient/${patientId}`,
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
        },
      ],
      locationReference: [
        {
          type: 'Location',
          reference: `Location/${location.id}`,
        },
      ],
      authoredOn: DateTime.now().toISO() || undefined,
      priority: 'routine',
      code: serviceRequestCode,
      reasonCode: serviceRequestReasonCode,
      instantiatesCanonical: [`#${activityDefinitionToContain.id}`],
      contained: [activityDefinitionToContain],
    };
    if (coverage) {
      serviceRequestConfig.insurance = [
        {
          reference: `Coverage/${coverage.id}`,
        },
      ];
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
    const serviceRequestFullUrl = `urn:uuid:${randomUUID()}`;

    const preSubmissionTaskConfig: Task = {
      resourceType: 'Task',
      intent: 'order',
      encounter: {
        reference: `Encounter/${encounter.id}`,
      },
      location: {
        reference: `Location/${location.id}`,
      },
      basedOn: [
        {
          type: 'ServiceRequest',
          reference: serviceRequestFullUrl,
        },
      ],
      status: 'ready',
      authoredOn: DateTime.now().toISO() || undefined,
      code: {
        coding: [
          {
            system: LAB_ORDER_TASK.system,
            code: LAB_ORDER_TASK.code.presubmission,
          },
        ],
      },
    };

    const aoeQRConfig = formatAoeQR(serviceRequestFullUrl, encounter.id || '', orderableItem);
    if (aoeQRConfig) {
      const aoeQRFullUrl = `urn:uuid:${randomUUID()}`;
      const postQrRequest: BatchInputRequest<QuestionnaireResponse> = {
        method: 'POST',
        url: '/QuestionnaireResponse',
        resource: aoeQRConfig,
        fullUrl: aoeQRFullUrl,
      };
      requests.push(postQrRequest);
      serviceRequestConfig.supportingInfo = [
        {
          type: 'QuestionnaireResponse',
          reference: aoeQRFullUrl,
        },
      ];
    }

    const provenanceFullUrl = `urn:uuid:${randomUUID()}`;
    const provenanceConfig = getProvenanceConfig(
      serviceRequestFullUrl,
      location.id || '',
      curUserPractitionerId,
      attendingPractitionerId
    );
    serviceRequestConfig.relevantHistory = [
      {
        reference: provenanceFullUrl,
      },
    ];

    requests.push({
      method: 'POST',
      url: '/Provenance',
      resource: provenanceConfig,
      fullUrl: provenanceFullUrl,
    });
    requests.push({
      method: 'POST',
      url: '/Task',
      resource: preSubmissionTaskConfig,
    });
    requests.push({
      method: 'POST',
      url: '/ServiceRequest',
      resource: serviceRequestConfig,
      fullUrl: serviceRequestFullUrl,
    });

    console.log('making transaction request');
    await oystehr.fhir.transaction({ requests });

    return {
      statusCode: 200,
      body: JSON.stringify('successfully created fhir resources for lab order'),
    };
  } catch (error: any) {
    await topLevelCatch('admin-create-lab-order', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error creating lab order: ${error}` }),
    };
  }
};

const formatAoeQR = (
  serviceRequestFullUrl: string,
  encounterId: string,
  orderableItem: OrderableItemSearchResult
): QuestionnaireResponse | undefined => {
  if (!orderableItem.item.aoe) return;
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: orderableItem.item.aoe.url,
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    basedOn: [
      {
        type: 'ServiceRequest',
        reference: serviceRequestFullUrl,
      },
    ],
    status: 'in-progress',
  };
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

const formatActivityDefinitionToContain = (orderableItem: OrderableItemSearchResult): ActivityDefinition => {
  const activityDefinitionConfig: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    id: 'activityDefinitionId',
    status: 'unknown',
    code: {
      coding: [
        {
          system: OYSTEHR_LAB_OI_CODE_SYSTEM,
          code: orderableItem.item.itemCode,
          display: orderableItem.item.itemName,
        },
      ],
    },
    publisher: orderableItem.lab.labName,
    kind: 'ServiceRequest',
    title: orderableItem.item.itemName,
    name: orderableItem.item.uniqueName,
    url: `https://labs-api.zapehr.com/v1/orderableItem?labIds=${orderableItem.lab.labGuid}&itemCodes=${orderableItem.item.itemCode}`,
    version: orderableItem.lab.compendiumVersion,
  };

  return activityDefinitionConfig;
};

const getProvenanceConfig = (
  serviceRequestFullUrl: string,
  locationId: string,
  currentUserId: string,
  attendingPractitionerId: string
): Provenance => {
  return {
    resourceType: 'Provenance',
    activity: {
      coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
    },
    target: [
      {
        reference: serviceRequestFullUrl,
      },
    ],
    location: { reference: `Location/${locationId}` },
    recorded: DateTime.now().toISO(),
    agent: [
      {
        who: { reference: `Practitioner/${currentUserId}` },
        onBehalfOf: { reference: `Practitioner/${attendingPractitionerId}` },
      },
    ],
  };
};

const getAdditionalResources = async (
  orderableItem: OrderableItemSearchResult,
  encounter: Encounter,
  oystehr: Oystehr
): Promise<{
  labOrganization: Organization;
  coverage?: Coverage;
  location: Location;
  patientId: string;
}> => {
  const labGuid = orderableItem.lab.labGuid;
  const labOrganizationSearchRequest: BatchInputRequest<Organization> = {
    method: 'GET',
    url: `/Organization?identifier=${labGuid}`,
  };
  const encounterResourceSearch: BatchInputRequest<Patient | Location | Coverage | Account> = {
    method: 'GET',
    url: `/Encounter?_id=${encounter.id}&_include=Encounter:patient&_include=Encounter:location&_revinclude:iterate=Coverage:patient&_revinclude:iterate=Account:patient`,
  };

  console.log('searching for lab org and encounter resources');
  const searchResults: Bundle<FhirResource> = await oystehr.fhir.batch({
    requests: [labOrganizationSearchRequest, encounterResourceSearch],
  });

  const labOrganizationSearchResults: Organization[] = [];
  const coverageSearchResults: Coverage[] = [];
  const accountSearchResults: Account[] = [];
  let patientId: string | undefined;
  let location: Location | undefined;

  const resources = flattenBundleResources<Organization | Coverage | Patient | Location | Account>(searchResults);

  resources.forEach((resource) => {
    if (resource.resourceType === 'Organization') labOrganizationSearchResults.push(resource as Organization);
    if (resource.resourceType === 'Coverage' && resource.status === 'active')
      coverageSearchResults.push(resource as Coverage);
    if (resource.resourceType === 'Patient') patientId = resource.id;
    if (resource.resourceType === 'Location') location = resource as Location;
    if (resource.resourceType === 'Account' && resource.status === 'active')
      accountSearchResults.push(resource as Account);
  });

  if (accountSearchResults.length !== 1)
    throw new Error('patient must have one account account record to represent a guarantor to order labs');

  const patientAccount = accountSearchResults[0];
  const patientPrimaryInsurance = getPrimaryInsurance(patientAccount, coverageSearchResults);

  const missingRequiredResourcse: string[] = [];
  if (!patientId) missingRequiredResourcse.push('patient');
  if (!location) missingRequiredResourcse.push('location');
  if (!patientId || !location) {
    throw new Error(
      `The following resources could not be found for this encounter: ${missingRequiredResourcse.join(', ')}`
    );
  }

  // todo throw defined error to allow for more clear / useful error message on front end
  const labOrganization = labOrganizationSearchResults?.[0];
  if (!labOrganization) {
    throw new Error(`Could not find lab organization for lab guid ${labGuid}`);
  }

  return {
    labOrganization,
    coverage: patientPrimaryInsurance,
    location,
    patientId,
  };
};
