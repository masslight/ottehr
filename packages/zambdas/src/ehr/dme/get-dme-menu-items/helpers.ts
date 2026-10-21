import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { DmeMenuItem } from 'utils/lib/types/api/dme.types';
import { APIError, FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { DME_MENU_ITEM_SEARCH_TAG, isDmeMenuItem, parseDmeMenuItem } from '../../../shared/dme';
import { isFhirNotFoundError } from '../../../shared/errors';

const normalizeName = (name: string): string => name.trim().toLowerCase();

export const searchDmeMenuItems = async (oystehr: Oystehr): Promise<DmeMenuItem[]> => {
  const resources = await getAllFhirSearchPages<ActivityDefinition>(
    {
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: DME_MENU_ITEM_SEARCH_TAG },
        { name: 'status', value: 'active' },
      ],
    },
    oystehr
  );
  return resources
    .filter((resource) => isDmeMenuItem(resource))
    .map((resource) => parseDmeMenuItem(resource))
    .filter((item): item is DmeMenuItem => !!item)
    .sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)));
};

export const assertDmeMenuItemNameAvailable = async (oystehr: Oystehr, name: string, ownId?: string): Promise<void> => {
  const items = await searchDmeMenuItems(oystehr);
  if (items.some((item) => item.id !== ownId && normalizeName(item.name) === normalizeName(name))) {
    throw INVALID_INPUT_ERROR(`A DME item named "${name.trim()}" already exists`);
  }
};

export const getDmeMenuItemResourceOrThrow = async (oystehr: Oystehr, id: string): Promise<ActivityDefinition> => {
  const notFound: APIError = { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`DME item ${id} not found`), statusCode: 404 };
  let resource: ActivityDefinition;
  try {
    resource = await oystehr.fhir.get<ActivityDefinition>({ resourceType: 'ActivityDefinition', id });
  } catch (error) {
    if (isFhirNotFoundError(error) || (error as { code?: unknown })?.code === 410) throw notFound;
    throw error;
  }
  if (!isDmeMenuItem(resource)) throw notFound;
  return resource;
};

export const uniqueByCode = <T extends { code: string }>(codes: T[]): T[] =>
  codes.filter((c, i) => codes.findIndex((other) => other.code.trim() === c.code.trim()) === i);
