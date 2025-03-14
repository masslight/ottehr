import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Location } from 'fhir/r4b';
import {
  BookableItem,
  BookableItemListResponse,
  createOystehrClient,
  GetBookableItemListParams,
  isLocationVirtual,
  ServiceMode,
  ServiceModeCoding,
  serviceModeForHealthcareService,
  stateCodeToFullName,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { getSecret, SecretsKeys, topLevelCatch } from 'zambda-utils';
import { getAuth0Token } from '../../shared';
import { getSlugForBookableResource } from '../helpers';

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);
    const projectAPI = getSecret(SecretsKeys.PROJECT_API, input.secrets);
    const { serviceMode: serviceType } = validateRequestParameters(input);

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);

    let response: BookableItemListResponse;
    if (serviceType === 'virtual') {
      response = { items: await getTelemedLocations(oystehr), categorized: false };
    } else {
      const items = (
        await Promise.all([getPhysicalLocations(oystehr), getGroups(oystehr, ServiceMode['in-person'])])
      ).flatMap((i) => i);
      response = { items, categorized: false };
    }

    response.items = response.items.sort((i1, i2) => i1.label.localeCompare(i2.label));
    console.log('response items', response.items);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Failed to get bookables', error);
    return topLevelCatch('list-bookables', error, input.secrets);
  }
};

async function getTelemedLocations(oystehr: Oystehr): Promise<BookableItem[]> {
  const resources = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [],
    })
  ).unbundle();

  // todo: add a relationship to a HealthcareService for all TM locations with a specific type property to
  // make this fhir-queryable?
  const telemedLocations = resources.filter((location) => isLocationVirtual(location));

  const someUndefiend = telemedLocations.map((location) => makeBookableVirtualLocation(location));

  const items = someUndefiend.filter((item) => !!item) as BookableItem[];
  return items;
}

async function getGroups(oystehr: Oystehr, serviceMode: ServiceMode): Promise<BookableItem[]> {
  const params: SearchParam[] = [];
  if (serviceMode === ServiceMode['in-person']) {
    params.push({ name: 'characteristic', value: ServiceModeCoding.inPerson.fullParam });
  } else {
    params.push({
      name: 'characteristic',
      value: [
        ServiceModeCoding.chat.fullParam,
        ServiceModeCoding.telephone.fullParam,
        ServiceModeCoding.videoconference.fullParam,
      ].join(','),
    });
  }
  const resources = (
    await oystehr.fhir.search<HealthcareService | Location>({
      resourceType: 'HealthcareService',
      params,
    })
  ).unbundle();

  console.log('group resources', resources);
  const hsObjects: { hs: HealthcareService; loc: Location[] }[] = [];
  resources.forEach((hsOrLoc, idx) => {
    if (hsOrLoc.resourceType === 'HealthcareService') {
      const hs: HealthcareService = hsOrLoc;
      const loc = resources.slice(idx).filter((res) => {
        return (
          res.resourceType === 'Location' &&
          hs.location?.some((locRef) => {
            return locRef.reference === `Location/${res.id}`;
          })
        );
      }) as Location[];
      hsObjects.push({ hs, loc });
    }
  });

  const someUndefiend = hsObjects.map((group) => makeBookableGroup(group.hs));
  const items = someUndefiend.filter((item) => !!item) as BookableItem[];
  return items;
}

async function getPhysicalLocations(oystehr: Oystehr): Promise<BookableItem[]> {
  const resources = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'address-city:missing',
          value: 'false',
        },
      ],
    })
  ).unbundle();

  const physicalLocations = resources.filter((location) => !isLocationVirtual(location));

  console.log('physical locations found', physicalLocations);

  const someUndefiend = physicalLocations.map((location) => makeBookablePhysicalLocation(location));
  const items = someUndefiend.filter((item) => !!item) as BookableItem[];
  return items;
}

const makeBookableVirtualLocation = (location: Location): BookableItem | undefined => {
  const stateCode = location.address?.state || '';
  const stateFullName = stateCodeToFullName[location.address?.state || ''] ?? '';
  const isActive = location.status === 'active';
  const slug = getSlugForBookableResource(location);

  if (!slug || !location.id || !isActive) {
    return undefined;
  }

  const label = stateFullName;
  return {
    label,
    slug,
    serviceMode: ServiceMode.virtual,
    resourceType: 'Location',
    resourceId: location.id,
    secondaryLabel: [],
    state: stateCode,
  };
};

const makeBookablePhysicalLocation = (location: Location): BookableItem | undefined => {
  const isActive = location.status === 'active';
  const slug = getSlugForBookableResource(location);
  const stateFullName = stateCodeToFullName[location.address?.state || ''] ?? '';

  if (!slug || !location.id || !isActive) {
    return undefined;
  }

  const label = location.name ?? slug;
  return {
    label,
    slug,
    resourceType: 'Location',
    resourceId: location.id,
    secondaryLabel: [],
    category: stateFullName,
  };
};

const makeBookableGroup = (service: HealthcareService): BookableItem | undefined => {
  const slug = getSlugForBookableResource(service);

  if (!slug || !service.id) {
    return undefined;
  }

  const label = service.name ?? slug;
  return {
    label,
    slug,
    serviceMode: serviceModeForHealthcareService(service),
    resourceType: 'HealthcareService',
    resourceId: service.id,
    secondaryLabel: [],
  };
};

function validateRequestParameters(input: ZambdaInput): GetBookableItemListParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { serviceMode } = JSON.parse(input.body);
  if (!serviceMode) {
    throw new Error('serviceType parameter ("in-person"|"virtual") is required');
  }

  return {
    serviceMode,
  };
}
