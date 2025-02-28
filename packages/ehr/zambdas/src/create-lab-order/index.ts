import { APIGatewayProxyResult } from 'aws-lambda';
import {
  DiagnosisDTO,
  OrderableItemSearchResult,
  PSC_HOLD_CONFIG,
  LAB_ORDER_TASK,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  FHIR_IDC10_VALUESET_SYSTEM,
  flattenBundleResources,
} from 'utils';
import { topLevelCatch, Secrets, ZambdaInput } from 'zambda-utils';
import { checkOrCreateM2MClientToken } from '../../../../intake/zambdas/src/shared';
import { createOystehrClient } from '../../../../intake/zambdas/src/shared/helpers';
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
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import Oystehr from '@oystehr/sdk';

export interface SubmitLabOrder {
  dx: DiagnosisDTO[];
  patientId: string;
  encounter: Encounter;
  coverage: Coverage;
  location: Location;
  practitionerId: string;
  orderableItem: OrderableItemSearchResult;
  pscHold: boolean;
  secrets: Secrets | null;
}

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { dx, patientId, encounter, coverage, location, practitionerId, orderableItem, pscHold, secrets } =
      validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const labGuid = orderableItem.lab.labGuid;
    const labOrganizationSearchRequest: BatchInputRequest<Organization> = {
      method: 'GET',
      url: `/Organization?identifier=${labGuid}`,
    };

    const activityDefinitionSearchRequest: BatchInputRequest<ActivityDefinition> = {
      method: 'GET',
      url: `/ActivityDefinition?name=${orderableItem.item.uniqueName}&publisher=${orderableItem.lab.labName}&version=${orderableItem.lab.compendiumVersion}`,
    };

    const searchResults: Bundle<FhirResource> = await oystehr.fhir.batch({
      requests: [labOrganizationSearchRequest, activityDefinitionSearchRequest],
    });

    const labOrganizationSearchResults: Organization[] = [];
    const activityDefinitionSearchResults: ActivityDefinition[] = [];

    const resources = flattenBundleResources(searchResults);
    resources.forEach((resource) => {
      if (resource.resourceType === 'Organization') labOrganizationSearchResults.push(resource as Organization);
      if (resource.resourceType === 'ActivityDefinition')
        activityDefinitionSearchResults.push(resource as ActivityDefinition);
    });

    if (labOrganizationSearchResults.length === 0) {
      throw new Error(`could not find lab organization for lab guid ${labGuid}`);
    }
    const labOrganization = labOrganizationSearchResults[0];

    const requests: BatchInputRequest<FhirResource>[] = [];

    const { activityDefinitionId, activityDefinitionToContain } = await handleActivityDefinition(
      activityDefinitionSearchResults,
      orderableItem,
      oystehr
    );

    const serviceRequestCode = fromateSrCode(orderableItem);
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
      insurance: [
        {
          reference: `Coverage/${coverage.id}`,
        },
      ],
      encounter: {
        reference: `Encounter/${encounter.id}`,
      },
      requester: {
        reference: `Practitioner/${practitionerId}`,
      },
      performer: [
        {
          reference: `Organization/${labOrganization.id}`,
        },
      ],
      priority: 'routine',
      code: serviceRequestCode,
      reasonCode: serviceRequestReasonCode,
      instantiatesCanonical: [`#${activityDefinitionId}`],
      contained: [activityDefinitionToContain],
    };

    if (pscHold) {
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
        reference: `Location/${location?.id}`,
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
      body: JSON.stringify({ message: `Error submitting lab order: ${error}` }),
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

const fromateSrCode = (orderableItem: OrderableItemSearchResult): ServiceRequest['code'] => {
  const coding: Coding[] = [
    {
      system: OYSTEHR_LAB_OI_CODE_SYSTEM,
      code: orderableItem.item.itemCode,
      display: orderableItem.item.itemName,
    },
  ];
  if (orderableItem.item.itemLoinc) {
    coding.push({
      // todo double check how oystehr handles multiple codes (pretty sure its handled but want to double check)
      system: 'http://loinc.org', // is this right??
      code: orderableItem.item.itemLoinc,
    });
  }
  return {
    coding,
    text: orderableItem.item.itemName,
  };
};

const handleActivityDefinition = async (
  activityDefinitionSearchResults: ActivityDefinition[],
  orderableItem: OrderableItemSearchResult,
  oystehr: Oystehr
): Promise<{ activityDefinitionId: string; activityDefinitionToContain: any }> => {
  const activityDefinition: ActivityDefinition = activityDefinitionSearchResults?.[0];

  let activityDefinitionId: string | undefined;
  let activityDefinitionToContain: any;

  if (!activityDefinition) {
    const activityDefinitionConfig: ActivityDefinition = {
      resourceType: 'ActivityDefinition',
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
    console.log(
      'creating a new activityDefinition for orderable item',
      orderableItem.item.itemCode,
      orderableItem.item.itemName,
      orderableItem.lab.labName,
      orderableItem.lab.compendiumVersion
    );
    activityDefinitionToContain = activityDefinitionConfig;
    const newActivityDef = await oystehr.fhir.create<ActivityDefinition>(activityDefinitionConfig);
    activityDefinitionId = newActivityDef.id;
  } else if (activityDefinition) {
    console.log(
      'activityDefinition found for orderable item',
      orderableItem.item.itemCode,
      orderableItem.item.itemName,
      orderableItem.lab.labName,
      orderableItem.lab.compendiumVersion
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { meta, ...activityDefToContain } = activityDefinition;
    activityDefinitionToContain = activityDefToContain;
    activityDefinitionId = activityDefinition.id;
  }

  if (!activityDefinitionId)
    throw new Error(`issue finding or creating activity definition for this lab orderable item`);

  return { activityDefinitionId, activityDefinitionToContain };
};
