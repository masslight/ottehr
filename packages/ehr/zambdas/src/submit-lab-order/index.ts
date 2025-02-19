import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosisDTO } from 'utils';
import { topLevelCatch, Secrets, ZambdaInput } from 'zambda-utils';
import { checkOrCreateM2MClientToken } from '../../../../intake/zambdas/src/shared';
import { createOystehrClient } from '../../../../intake/zambdas/src/shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';
import {
  Encounter,
  Location,
  ServiceRequest,
  Specimen,
  QuestionnaireResponse,
  Task,
  Organization,
  Coding,
  FhirResource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';

export interface SubmitLabOrder {
  // once oystehr labs is live there will also be an orderable item that is passed as well
  dx: DiagnosisDTO;
  patientId: string;
  encounter: Encounter;
  location: Location;
  practitionerId: string;
  orderableItem: any; // todo we should get this type from oystehr
  pscHold: boolean;
  secrets: Secrets | null;
}

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { dx, patientId, encounter, location, practitionerId, orderableItem, pscHold, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    // todo map this to the SR
    console.log('pscHold', pscHold);

    const labGuid = orderableItem.lab.labGuid;
    const labOrganizationSearch = (
      await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          {
            name: 'identifier',
            value: labGuid,
          },
        ],
      })
    ).unbundle();

    if (labOrganizationSearch.length === 0) {
      throw new Error(`could not find lab organization for lab guid ${labGuid}`);
    }

    const labOrganization = labOrganizationSearch[0];

    const serviceRequestCode = fromateSrCode(orderableItem);
    const serviceRequestConfig: ServiceRequest = {
      // SR mappings missing
      // insurance (pending finalization on converting paperwork to coverage)
      // instantiatesCanonical (skipping atm)
      // contained (skipping atm)
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
        reference: `Practitioner/${practitionerId}`,
      },
      performer: [
        {
          reference: `Organization/${labOrganization.id}`,
        },
      ],
      priority: 'routine',
      code: serviceRequestCode,
      reasonCode: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/valueset-icd-10.html',
              code: dx?.code,
              display: dx?.display,
            },
          ],
          text: dx?.display,
        },
      ],
    };
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
            system: 'external-lab-task', // todo make a const when definition is agreed upon
            code: 'presubmission', // todo make a const
          },
        ],
      },
    };

    const requests: BatchInputRequest<FhirResource>[] = [];

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

    const specimenConfig = formatSpecimen(orderableItem);
    if (specimenConfig) {
      const specimenFullUrl = `urn:uuid:${randomUUID()}`;
      const postSpecimenRequest: BatchInputRequest<Specimen> = {
        method: 'POST',
        url: '/Specimen',
        resource: specimenConfig,
        fullUrl: specimenFullUrl,
      };
      serviceRequestConfig.specimen = [
        {
          type: 'Specimen',
          reference: specimenFullUrl,
        },
      ];
      requests.push(postSpecimenRequest);
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
    await topLevelCatch('admin-submit-lab-order', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error submitting lab order: ${error}` }),
    };
  }
};

// todo update oi type when we have one
const formatSpecimen = (orderableItem: any): Specimen | undefined => {
  if (!orderableItem.item.specimens.length) return;

  const specimen = orderableItem.item.specimens[0];
  return {
    resourceType: 'Specimen',
    // todo should these urls be formatted differently ? also need to make em consts after format is agreed on
    extension: [
      {
        url: 'container',
        valueString: specimen.container,
      },
      {
        url: 'volume',
        valueString: specimen.volume,
      },
      {
        url: 'minimumVolume',
        valueString: specimen.minimumVolume,
      },
      {
        url: 'storageRequirements',
        valueString: specimen.storageRequirements,
      },
      {
        url: 'collectionInstructions',
        valueString: specimen.collectionInstructions,
      },
    ],
  };
};

// todo update oi type when we have one
const formatAoeQR = (
  serviceRequestFullUrl: string,
  encoutnerId: string,
  orderableItem: any
): QuestionnaireResponse | undefined => {
  if (!orderableItem.item.aoe) return;
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: orderableItem.item.aoe.url,
    encounter: {
      reference: `Encounter/${encoutnerId}`,
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

// todo update oi type when we have one
// todo fix code systems
const fromateSrCode = (orderableItem: any): ServiceRequest['code'] => {
  const coding: Coding[] = [
    {
      system: 'placeholder', // i guess we will just make this ?
      code: orderableItem.item.itemCode,
      display: orderableItem.item.itemName,
    },
  ];
  if (orderableItem.item.itemLoinc) {
    coding.push({
      system: 'http://loinc.org', // is this right??
      code: orderableItem.item.itemLoinc,
    });
  }
  return {
    coding,
    text: orderableItem.item.itemName,
  };
};
