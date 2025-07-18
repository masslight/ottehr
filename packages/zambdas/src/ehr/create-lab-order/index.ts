import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  Account,
  ActivityDefinition,
  Coding,
  Coverage,
  Encounter,
  FhirResource,
  Location,
  Organization,
  Patient,
  Provenance,
  QuestionnaireResponse,
  ServiceRequest,
  Specimen,
  SpecimenDefinition,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APIError,
  CreateLabOrderZambdaOutput,
  EXTERNAL_LAB_ERROR,
  FHIR_IDC10_VALUESET_SYSTEM,
  flattenBundleResources,
  getSecret,
  isApiError,
  LAB_ORDER_TASK,
  OrderableItemSearchResult,
  OrderableItemSpecimen,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  PSC_HOLD_CONFIG,
  RELATED_SPECIMEN_DEFINITION_SYSTEM,
  SecretsKeys,
  SPECIMEN_CODING_CONFIG,
} from 'utils';
import { checkOrCreateM2MClientToken, getMyPractitionerId, topLevelCatch, wrapHandler } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { ZambdaInput } from '../../shared/types';
import { getAttendingPractitionerId } from '../shared/in-house-labs';
import { getPrimaryInsurance } from '../shared/labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('create-lab-order', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { dx, encounter, orderableItem, psc, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    let curUserPractitionerId: string | undefined;
    try {
      curUserPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    } catch (e) {
      throw EXTERNAL_LAB_ERROR(
        'Resource configuration error - user creating this external lab order must have a Practitioner resource linked'
      );
    }
    console.log('>>> this is the encounter, ', JSON.stringify(encounter, undefined, 2));
    const attendingPractitionerId = getAttendingPractitionerId(encounter);

    if (!attendingPractitionerId) {
      // this should never happen since theres also a validation on the front end that you cannot submit without one
      throw EXTERNAL_LAB_ERROR(
        'Resource configuration error - this encounter does not have an attending practitioner linked'
      );
    }

    console.log('encounter id', encounter.id);
    const { labOrganization, coverage, location, patientId } = await getAdditionalResources(
      orderableItem,
      encounter,
      oystehr
    );

    const requests: BatchInputRequest<FhirResource>[] = [];
    const serviceRequestFullUrl = `urn:uuid:${randomUUID()}`;

    const activityDefinitionToContain = formatActivityDefinitionToContain(orderableItem);
    const serviceRequestContained: FhirResource[] = [];

    const createSpecimenResources = !psc;
    console.log('createSpecimenResources', createSpecimenResources, psc, orderableItem.item.specimens.length);
    const specimenFullUrlArr: string[] = [];
    if (createSpecimenResources) {
      const { specimenDefinitionConfigs, specimenConfigs } = formatSpecimenResources(
        orderableItem,
        patientId,
        serviceRequestFullUrl
      );
      activityDefinitionToContain.specimenRequirement = specimenDefinitionConfigs.map((sd) => ({
        reference: `#${sd.id}`,
      }));
      serviceRequestContained.push(activityDefinitionToContain, ...specimenDefinitionConfigs);
      specimenConfigs.forEach((specimenResource) => {
        const specimenFullUrl = `urn:uuid:${randomUUID()}`;
        specimenFullUrlArr?.push(specimenFullUrl);
        requests.push({
          method: 'POST',
          url: '/Specimen',
          resource: specimenResource,
          fullUrl: specimenFullUrl,
        });
      });
    } else {
      serviceRequestContained.push(activityDefinitionToContain);
    }

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
      authoredOn: DateTime.now().toISO() || undefined,
      priority: 'stat',
      code: serviceRequestCode,
      reasonCode: serviceRequestReasonCode,
      instantiatesCanonical: [`#${activityDefinitionToContain.id}`],
      contained: serviceRequestContained,
    };
    if (location) {
      serviceRequestConfig.locationReference = [
        {
          type: 'Location',
          reference: `Location/${location.id}`,
        },
      ];
    }
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
    if (specimenFullUrlArr.length > 0) {
      serviceRequestConfig.specimen = specimenFullUrlArr.map((url) => ({
        type: 'Specimen',
        reference: url,
      }));
    }

    const preSubmissionTaskConfig: Task = {
      resourceType: 'Task',
      intent: 'order',
      encounter: {
        reference: `Encounter/${encounter.id}`,
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
            code: LAB_ORDER_TASK.code.preSubmission,
          },
        ],
      },
    };
    if (location) {
      preSubmissionTaskConfig.location = {
        reference: `Location/${location.id}`,
      };
    }

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
      location?.id,
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

    const response: CreateLabOrderZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-create-lab-order', error, ENVIRONMENT);
    let body = JSON.stringify({ message: `Error creating external lab order: ${error}` });
    if (isApiError(error)) {
      const { code, message } = error as APIError;
      body = JSON.stringify({ message, code });
    }
    return {
      statusCode: 500,
      body,
    };
  }
});

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

const formatSpecimenResources = (
  orderableItem: OrderableItemSearchResult,
  patientID: string,
  serviceRequestFullUrl: string
): { specimenDefinitionConfigs: SpecimenDefinition[]; specimenConfigs: Specimen[] } => {
  const specimenDefinitionConfigs: SpecimenDefinition[] = [];
  const specimenConfigs: Specimen[] = [];

  // facilitates always showing specimen entry on submit page
  // https://github.com/masslight/ottehr/issues/2934
  if (orderableItem.item.specimens.length === 0) {
    const { specimenDefinitionConfig, specimenConfig } = getSpecimenAndSpecimenDefConfig(
      serviceRequestFullUrl,
      patientID,
      0,
      undefined
    );
    specimenDefinitionConfigs.push(specimenDefinitionConfig);
    specimenConfigs.push(specimenConfig);
  } else {
    orderableItem.item.specimens.forEach((specimen, idx) => {
      const { specimenDefinitionConfig, specimenConfig } = getSpecimenAndSpecimenDefConfig(
        serviceRequestFullUrl,
        patientID,
        idx,
        specimen
      );
      specimenDefinitionConfigs.push(specimenDefinitionConfig);
      specimenConfigs.push(specimenConfig);
    });
  }

  return { specimenDefinitionConfigs, specimenConfigs };
};

const getProvenanceConfig = (
  serviceRequestFullUrl: string,
  locationId: string | undefined,
  currentUserId: string,
  attendingPractitionerId: string
): Provenance => {
  const provenanceConfig: Provenance = {
    resourceType: 'Provenance',
    activity: {
      coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
    },
    target: [
      {
        reference: serviceRequestFullUrl,
      },
    ],
    recorded: DateTime.now().toISO(),
    agent: [
      {
        who: { reference: `Practitioner/${currentUserId}` },
        onBehalfOf: { reference: `Practitioner/${attendingPractitionerId}` },
      },
    ],
  };
  if (locationId) provenanceConfig.location = { reference: `Location/${locationId}` };
  return provenanceConfig;
};

const getAdditionalResources = async (
  orderableItem: OrderableItemSearchResult,
  encounter: Encounter,
  oystehr: Oystehr
): Promise<{
  labOrganization: Organization;
  patientId: string;
  coverage?: Coverage;
  location?: Location;
}> => {
  const labName = orderableItem.lab.labName;
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
    throw EXTERNAL_LAB_ERROR(
      'Please update responsible party information - patient must have one active account record to represent a guarantor to external lab orders'
    );

  const patientAccount = accountSearchResults[0];
  const patientPrimaryInsurance = getPrimaryInsurance(patientAccount, coverageSearchResults);

  const missingRequiredResources: string[] = [];
  if (!patientId) missingRequiredResources.push('patient');
  if (!patientId) {
    throw EXTERNAL_LAB_ERROR(
      `The following resources could not be found for this encounter: ${missingRequiredResources.join(', ')}`
    );
  }

  const labOrganization = labOrganizationSearchResults?.[0];
  if (!labOrganization) {
    throw EXTERNAL_LAB_ERROR(
      `Organization resource for ${labName} may be misconfigured. No organization found for lab guid ${labGuid}`
    );
  }

  return {
    labOrganization,
    patientId,
    coverage: patientPrimaryInsurance,
    location,
  };
};

const getSpecimenAndSpecimenDefConfig = (
  serviceRequestFullUrl: string,
  patientID: string,
  idx: number,
  specimen: OrderableItemSpecimen | undefined
): {
  specimenDefinitionConfig: SpecimenDefinition;
  specimenConfig: Specimen;
} => {
  // labs sometimes set container, volume, minimumVolume, storageRequirements, or collectionInstructions to null, so need to coalesce to undefined
  const collectionInstructionsCoding = {
    coding: [
      {
        system: SPECIMEN_CODING_CONFIG.collection.system,
        code: SPECIMEN_CODING_CONFIG.collection.code.collectionInstructions,
      },
    ],
    text: specimen?.collectionInstructions ?? undefined,
  };
  const specimenDefinitionId = `specimenDefinitionId${idx}`;
  const specimenDefinitionConfig: SpecimenDefinition = {
    resourceType: 'SpecimenDefinition',
    id: specimenDefinitionId,
    collection: [
      collectionInstructionsCoding,
      {
        coding: [
          {
            system: SPECIMEN_CODING_CONFIG.collection.system,
            code: SPECIMEN_CODING_CONFIG.collection.code.specimenVolume,
          },
        ],
        text: specimen?.volume ?? undefined,
      },
    ],
    typeTested: [
      {
        preference: 'preferred',
        container:
          !!specimen?.container || !!specimen?.minimumVolume
            ? {
                description: specimen.container ?? undefined,
                minimumVolumeString: specimen.minimumVolume ?? undefined,
              }
            : undefined,
        handling: specimen?.storageRequirements
          ? [
              {
                instruction: specimen.storageRequirements,
              },
            ]
          : undefined,
      },
    ],
  };

  const specimenConfig: Specimen = {
    resourceType: 'Specimen',
    request: [{ reference: serviceRequestFullUrl }],
    collection: {
      method: collectionInstructionsCoding,
    },
    extension: [
      {
        url: RELATED_SPECIMEN_DEFINITION_SYSTEM,
        valueString: specimenDefinitionId,
      },
    ],
    subject: {
      type: 'Patient',
      reference: `Patient/${patientID}`,
    },
  };
  return { specimenDefinitionConfig, specimenConfig };
};
