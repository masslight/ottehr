import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import {
  GetPractitionerNamesInputSchema,
  MAX_PRACTITIONER_NAMES_IDS,
} from 'utils/lib/types/api/practitioner-names.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));

import { performEffect } from '../../src/ehr/get-practitioner-names';

const ADA_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';
const NAMELESS_ID = '7b1c4a2e-0d3f-4c5b-8e6a-1f2d3c4b5a69';
const MISSING_ID = '2e9e1a9e-5a1f-4b6e-9a51-9f6a3f1c2d3e';

const practitioners: Practitioner[] = [
  {
    resourceType: 'Practitioner',
    id: ADA_ID,
    name: [{ given: ['Ada'], family: 'Lovelace', suffix: ['MD'] }],
  },
  { resourceType: 'Practitioner', id: NAMELESS_ID },
];

const search = vi.fn();
const oystehr = { fhir: { search } } as unknown as Oystehr;

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue({ unbundle: () => practitioners });
});

describe('get-practitioner-names', () => {
  it('names each Practitioner first + last, in one search', async () => {
    const result = await performEffect(oystehr, [ADA_ID, NAMELESS_ID, MISSING_ID, ADA_ID]);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Practitioner',
      params: [
        { name: '_id', value: `${ADA_ID},${NAMELESS_ID},${MISSING_ID}` },
        { name: '_count', value: '3' },
      ],
    });
    // unknown and nameless Practitioners are left out; credentials are not part of the name
    expect(result).toEqual({ names: { [ADA_ID]: 'Ada Lovelace' } });
  });
});

describe('GetPractitionerNamesInputSchema', () => {
  it('accepts Practitioner ids', () => {
    expect(GetPractitionerNamesInputSchema.safeParse({ practitionerIds: [ADA_ID] }).success).toBe(true);
  });

  it.each([
    ['no ids', []],
    ['a non-uuid id', ['pr-1']],
    ['too many ids', Array.from({ length: MAX_PRACTITIONER_NAMES_IDS + 1 }, () => ADA_ID)],
  ])('rejects %s', (_name, practitionerIds) => {
    expect(GetPractitionerNamesInputSchema.safeParse({ practitionerIds }).success).toBe(false);
  });
});
