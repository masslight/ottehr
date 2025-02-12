import Oystehr, { BatchInputGetRequest, SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Bundle,
  Device,
  FhirResource,
  Group,
  List,
  Location,
  Medication,
  Patient,
  Practitioner,
  PractitionerRole,
  RelatedPerson,
  Resource,
  Substance,
} from 'fhir/r4b';
import { createOystehrClient } from 'utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { getAuth0Token } from '../src/shared';

export const fhirApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.fhir-api.zapehr.com';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.fhir-api.zapehr.com';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.fhir-api.zapehr.com';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.fhir-api.zapehr.com';
    case 'https://api.zapehr.com':
      return 'https://fhir-api.zapehr.com';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

// todo remove code duplication with configure-zapehr-secrets
export const projectApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.project-api.zapehr.com/v1';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.project-api.zapehr.com/v1';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.project-api.zapehr.com/v1';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.project-api.zapehr.com/v1';
    case 'https://api.zapehr.com':
      return 'https://project-api.zapehr.com/v1';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

type GroupMemberType =
  | Patient
  | RelatedPerson
  | Practitioner
  | PractitionerRole
  | Device
  | Medication
  | Substance
  | Group;
export function makeGroup<T extends GroupMemberType>(thingsToGroup: T[]): Group {
  const member = thingsToGroup.map((ttg) => {
    return {
      entity: { reference: `${ttg.resourceType}/${ttg.id}` },
    };
  });
  return {
    resourceType: 'Group',
    type: 'person',
    actual: true,
    member,
  };
}
export function makeList<T extends Resource>(thingsToGroup: T[]): List {
  const entry = thingsToGroup.map((ttg) => {
    console.log('ttg', ttg);
    return {
      item: { reference: `${ttg.resourceType}/${ttg.id}` },
    };
  });
  return {
    resourceType: 'List',
    mode: 'snapshot',
    status: 'current',
    entry,
  };
}

export interface GetConditionalPatchBinaryInput {
  url: string;
  patchOperations: Operation[];
}

export const batchSearch = async <T extends Resource>(
  batchRequests: BatchInputGetRequest[],
  oystehr: Oystehr
): Promise<T[]> => {
  let batchResults: Bundle<FhirResource>;
  try {
    batchResults = await oystehr.fhir.batch<FhirResource>({
      requests: batchRequests,
    });
  } catch (e) {
    console.log('error', e);
    throw e;
  }
  console.log('batchResults', batchResults?.entry);
  const entries = (batchResults.entry ?? []).flatMap((be) => {
    if (
      be.response?.outcome?.id === 'ok' &&
      be.resource &&
      be.resource.resourceType === 'Bundle' &&
      be.resource.type === 'searchset'
    ) {
      const innerBundle = be.resource as Bundle;
      const innerEntry = innerBundle.entry;
      if (!innerEntry) {
        return [];
      } else {
        return (innerBundle.entry ?? []).map((ibe) => ibe.resource as T);
      }
    } else {
      return [];
    }
  });
  const idSet = new Set<string>();

  return entries.filter((entry) => {
    const { id } = entry;
    if (!id) {
      return false;
    }
    if (idSet.has(id)) {
      return false;
    } else {
      idSet.add(id);
      return true;
    }
  });
};

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function sleep(period: number): Promise<void> {
  console.log(`Sleeping for ${period / 1000} seconds`);
  await timeout(period);
  console.log(`resuming program`);
}

export const getTimezoneFromLocation = (location: Location): string | undefined => {
  return (location.extension ?? []).find((ext) => {
    return ext.url === 'http://hl7.org/fhir/StructureDefinition/timezone';
  })?.valueString;
};

const getBatchParams = (batchNo: number, params: SearchParam[]): SearchParam[] => {
  return [
    ...params,
    {
      name: '_count',
      value: '1000',
    },
    {
      name: '_offset',
      value: `${1000 * batchNo}`,
    },
  ];
};

export const getAll = async <T extends FhirResource>(
  resourceType: string,
  params: SearchParam[],
  oystehr: Oystehr
): Promise<T[]> => {
  const bundle = await oystehr.fhir.search<T>({
    resourceType,
    params: [
      ...params,
      {
        name: '_count',
        value: '1',
      },
    ],
  });
  const numChunks = Math.ceil((bundle.total ?? 1000) / 1000);
  console.log('num chunks', numChunks);
  const paramArray = new Array(numChunks).fill(1).map((_, idx) => {
    return getBatchParams(idx, params);
  });
  const lists = [];
  for await (const params of paramArray) {
    const res = await oystehr.fhir.search<T>({
      resourceType: resourceType,
      params: params,
    });
    lists.push(res);
    await sleep(1500);
  }
  return lists.flatMap((list) => list.unbundle());
};

export const createOystehrClientFromConfig = async (config: Secrets): Promise<Oystehr> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  return createOystehrClientFromSecrets(token, config);
};

function createOystehrClientFromSecrets(token: string, secrets: Secrets | null): Oystehr {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  return createOystehrClient(token, FHIR_API, PROJECT_API);
}
