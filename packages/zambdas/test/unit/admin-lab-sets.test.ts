import { List } from 'fhir/r4b';
import {
  ExternalLabSetDTO,
  InHouseLabSetDTO,
  LAB_LIST_CODE_CODING,
  LAB_LIST_IDENTIFIER_SYSTEM,
  LAB_LIST_IN_HOUSE_ITEM_IDENTIFIER_SYSTEM,
  LAB_LIST_ITEM_SEARCH_FIELD_EXTENSION_URL,
  LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL,
  LabSetDTO,
  LabSetStatus,
  LabType,
} from 'utils';
import { describe, expect, it } from 'vitest';
import { configFhirListForLabSet, formatLabListDTOs, formatListEntry } from '../../src/ehr/lab/shared/helpers';

const makeExternalLabSetDTO = (overrides: Partial<ExternalLabSetDTO> = {}): ExternalLabSetDTO => ({
  listId: 'list-1',
  listName: 'External Lab Set',
  listStatus: LabSetStatus.active,
  listType: LabType.external,
  labs: [
    { display: 'CBC', itemCode: 'cbc-001', labGuid: 'guid-abc' },
    { display: 'BMP', itemCode: 'bmp-002', labGuid: 'guid-def' },
  ],
  ...overrides,
});

const makeInHouseLabSetDTO = (overrides: Partial<InHouseLabSetDTO> = {}): InHouseLabSetDTO => ({
  listId: 'list-2',
  listName: 'In-House Lab Set',
  listStatus: LabSetStatus.active,
  listType: LabType.inHouse,
  labs: [
    { display: 'Glucose', adUrl: 'https://example.com/ad/glucose' },
    { display: 'Strep', adUrl: 'https://example.com/ad/strep' },
  ],
  ...overrides,
});

// ─── formatListEntry ──────────────────────────────────────────────────────────

describe('formatListEntry - configures lab set DTO data into a Fhir ListEntry', () => {
  describe('external lab set', () => {
    const labSetDTO = makeExternalLabSetDTO();

    it('returns expected number of labs', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries).toHaveLength(2);
    });

    it('sets entry display is correct', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries[0].item.display).toBe('CBC');
      expect(entries[1].item.display).toBe('BMP');
    });

    it('sets identifier system to LAB_LIST_IDENTIFIER_SYSTEM', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries[0].item.identifier?.system).toBe(LAB_LIST_IDENTIFIER_SYSTEM);
    });

    it('sets identifier value to labGuid|itemCode', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries[0].item.identifier?.value).toBe('guid-abc|cbc-001');
      expect(entries[1].item.identifier?.value).toBe('guid-def|bmp-002');
    });

    it('attaches search-field extension with labGuid and itemCode nested extensions', () => {
      const entries = formatListEntry(labSetDTO);
      const parentExt = entries[0].item.extension?.find((e) => e.url === LAB_LIST_ITEM_SEARCH_FIELD_EXTENSION_URL);
      expect(parentExt).toBeDefined();

      const labGuidExt = parentExt?.extension?.find(
        (e) => e.url === LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL.labGuid
      );
      const itemCodeExt = parentExt?.extension?.find(
        (e) => e.url === LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL.itemCode
      );

      expect(labGuidExt?.valueString).toBe('guid-abc');
      expect(itemCodeExt?.valueString).toBe('cbc-001');
    });

    it('sets a date on each entry', () => {
      const entries = formatListEntry(labSetDTO);
      entries.forEach((entry) => expect(entry.date).toBeDefined());
    });
  });

  describe('in-house lab set', () => {
    const labSetDTO = makeInHouseLabSetDTO();

    it('returns one entry per lab', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries).toHaveLength(2);
    });

    it('sets entry display from lab display', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries[0].item.display).toBe('Glucose');
      expect(entries[1].item.display).toBe('Strep');
    });

    it('sets item type to ActivityDefinition', () => {
      const entries = formatListEntry(labSetDTO);
      entries.forEach((entry) => expect(entry.item.type).toBe('ActivityDefinition'));
    });

    it('sets identifier system to LAB_LIST_IN_HOUSE_ITEM_IDENTIFIER_SYSTEM', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries[0].item.identifier?.system).toBe(LAB_LIST_IN_HOUSE_ITEM_IDENTIFIER_SYSTEM);
    });

    it('sets identifier value to adUrl', () => {
      const entries = formatListEntry(labSetDTO);
      expect(entries[0].item.identifier?.value).toBe('https://example.com/ad/glucose');
      expect(entries[1].item.identifier?.value).toBe('https://example.com/ad/strep');
    });

    it('sets a date on each entry', () => {
      const entries = formatListEntry(labSetDTO);
      entries.forEach((entry) => expect(entry.date).toBeDefined());
    });
  });

  it('throws when listType is unrecognized', () => {
    const badLabSetDTO = { ...makeExternalLabSetDTO(), listType: 'unknown' } as unknown as LabSetDTO;
    expect(() => formatListEntry(badLabSetDTO)).toThrow();
  });
});

// ─── configFhirListForLabSet ──────────────────────────────────────────────────

describe('configFhirListForLabSet - configures lab set DTO data into a Fhir List', () => {
  const labSetDTOExternal = makeExternalLabSetDTO();
  const labSetDTOInHouse = makeInHouseLabSetDTO();

  it('returns a FHIR List resource', () => {
    const list = configFhirListForLabSet(labSetDTOExternal);
    expect(list.resourceType).toBe('List');
  });

  it('sets list title from listName', () => {
    const list = configFhirListForLabSet(labSetDTOExternal);
    expect(list.title).toBe('External Lab Set');
  });

  it('uses external code coding for external lab sets', () => {
    const list = configFhirListForLabSet(labSetDTOExternal);
    const coding = list.code?.coding?.[0];
    expect(coding).toEqual(LAB_LIST_CODE_CODING.external);
  });

  it('uses inHouse code coding for in-house lab sets', () => {
    const list = configFhirListForLabSet(labSetDTOInHouse);
    const coding = list.code?.coding?.[0];
    expect(coding).toEqual(LAB_LIST_CODE_CODING.inHouse);
  });

  it('sets status to current and mode to working', () => {
    const list = configFhirListForLabSet(labSetDTOInHouse);
    expect(list.status).toBe('current');
    expect(list.mode).toBe('working');
  });

  it('populates entries via formatListEntry', () => {
    const list = configFhirListForLabSet(labSetDTOInHouse);
    expect(list.entry).toHaveLength(labSetDTOInHouse.labs.length);
  });
});

// ─── formatLabListDTOs ────────────────────────────────────────────────────────

const makeExternalFhirList = (): List => ({
  resourceType: 'List',
  id: 'list-ext-1',
  status: 'current',
  mode: 'working',
  title: 'External Lab Set',
  code: {
    coding: [LAB_LIST_CODE_CODING.external],
  },
  entry: [
    {
      item: {
        display: 'CBC',
        identifier: {
          system: LAB_LIST_IDENTIFIER_SYSTEM,
          value: 'guid-abc|cbc-001',
        },
        extension: [
          {
            url: LAB_LIST_ITEM_SEARCH_FIELD_EXTENSION_URL,
            extension: [
              { url: LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL.labGuid, valueString: 'guid-abc' },
              { url: LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL.itemCode, valueString: 'cbc-001' },
            ],
          },
        ],
      },
    },
  ],
});

const makeInHouseFhirList = (): List => ({
  resourceType: 'List',
  id: 'list-ih-1',
  status: 'retired', // retired to test mapping to LabSetStatus.inactive
  mode: 'working',
  title: 'In-House Lab Set',
  code: {
    coding: [LAB_LIST_CODE_CODING.inHouse],
  },
  entry: [
    {
      item: {
        display: 'Glucose',
        identifier: {
          system: LAB_LIST_IN_HOUSE_ITEM_IDENTIFIER_SYSTEM,
          value: 'https://example.com/ad/glucose',
        },
      },
    },
  ],
});

describe('formatLabListDTOs - configures an array of Fhir Lists into an array of lab set DTOs', () => {
  const fhirListExternal = makeExternalFhirList();
  const fhirListInHouse = makeInHouseFhirList();

  it('returns undefined for an empty array', () => {
    expect(formatLabListDTOs([])).toBeUndefined();
  });

  it('formats an external FHIR List into an ExternalLabSetDTO', () => {
    const result = formatLabListDTOs([fhirListExternal]);
    expect(result).toHaveLength(1);
    const dto = result![0];
    expect(dto.listType).toBe(LabType.external);
    expect(dto.listId).toBe('list-ext-1');
    expect(dto.listName).toBe('External Lab Set');
    expect(dto.listStatus).toBe(LabSetStatus.active);
  });

  it('maps external lab entries with display, itemCode, labGuid', () => {
    const result = formatLabListDTOs([fhirListExternal]);
    const dto = result![0];
    if (dto.listType !== LabType.external) throw new Error('expected external type');
    expect(dto.labs).toHaveLength(1);
    expect(dto.labs[0].display).toBe('CBC');
    expect(dto.labs[0].itemCode).toBe('cbc-001');
    expect(dto.labs[0].labGuid).toBe('guid-abc');
  });

  it('formats an in-house FHIR List into an InHouseLabSetDTO', () => {
    const result = formatLabListDTOs([fhirListInHouse]);
    expect(result).toHaveLength(1);
    const dto = result![0];
    expect(dto.listType).toBe(LabType.inHouse);
    expect(dto.listId).toBe('list-ih-1');
    expect(dto.listName).toBe('In-House Lab Set');
    expect(dto.listStatus).toBe(LabSetStatus.inactive);
  });

  it('maps in-house lab entries with display and adUrl', () => {
    const result = formatLabListDTOs([fhirListInHouse]);
    const dto = result![0];
    if (dto.listType !== LabType.inHouse) throw new Error('expected inHouse type');
    expect(dto.labs).toHaveLength(1);
    expect(dto.labs[0].display).toBe('Glucose');
    expect(dto.labs[0].adUrl).toBe('https://example.com/ad/glucose');
  });

  it('skips lists with an unrecognized type and does not include them in results', () => {
    const unknownList: List = {
      resourceType: 'List',
      id: 'list-unknown',
      status: 'current',
      mode: 'working',
      title: 'Unknown',
      code: { coding: [{ system: 'some-other-system', code: 'unknown' }] },
    };
    const result = formatLabListDTOs([unknownList]);
    expect(result).toHaveLength(0);
  });

  it('handles a mix of external and in-house lists', () => {
    const result = formatLabListDTOs([fhirListExternal, fhirListInHouse]);
    expect(result).toHaveLength(2);
    expect(result![0].listType).toBe(LabType.external);
    expect(result![1].listType).toBe(LabType.inHouse);
  });

  it('falls back to a default title when list.title is missing', () => {
    const list = makeExternalFhirList();
    delete list.title;
    const result = formatLabListDTOs([list]);
    expect(result![0].listName).toBe('Lab List (title missing)');
  });

  it('uses a fallback listId when list.id is missing', () => {
    const list = makeExternalFhirList();
    delete list.id;
    const result = formatLabListDTOs([list]);
    expect(result![0].listId).toMatch(/^missing-/);
  });

  it('returns an empty labs array when list.entry is absent', () => {
    const list = makeExternalFhirList();
    delete list.entry;
    const result = formatLabListDTOs([list]);
    const dto = result![0];
    if (dto.listType !== LabType.external) throw new Error('expected external type');
    expect(dto.labs).toHaveLength(0);
  });

  it('throws when an external entry is missing the search field extension', () => {
    const list = makeExternalFhirList();
    list.entry![0].item.extension = [];
    expect(() => formatLabListDTOs([list])).toThrow();
  });
});
