import { List } from 'fhir/r4b';
import {
  CUSTOM_FOLDER_INTERNAL_NAME_PREFIX,
  deriveInternalFolderName,
  isCustomFolderList,
  parseCustomFoldersCatalog,
  parseCustomFoldersCatalogIncludingDeleted,
} from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters as validateCreate } from '../../src/ehr/create-custom-folder/validateRequestParameters';
import { validateRequestParameters as validateDelete } from '../../src/ehr/delete-custom-folder/validateRequestParameters';
import { validateRequestParameters as validateRename } from '../../src/ehr/rename-custom-folder/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

const mkInput = (body: unknown): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: null,
});

describe('create-custom-folder validateRequestParameters', () => {
  test('accepts a valid display name', () => {
    const result = validateCreate(mkInput({ folderName: 'After-Visit Care' }));
    expect(result.folderName).toBe('After-Visit Care');
    expect(result.userToken).toBe('test-token');
  });

  test('rejects an empty/whitespace name', () => {
    expect(() => validateCreate(mkInput({ folderName: '' }))).toThrow();
    expect(() => validateCreate(mkInput({ folderName: '   ' }))).toThrow();
  });

  test('rejects names longer than 60 chars', () => {
    expect(() => validateCreate(mkInput({ folderName: 'a'.repeat(61) }))).toThrow();
  });

  test('rejects disallowed characters', () => {
    // The schema only allows letters, digits, spaces, and the listed punctuation:
    // + ! - _ ' ( ) . @ $
    expect(() => validateCreate(mkInput({ folderName: 'Bad/Slash' }))).toThrow();
    expect(() => validateCreate(mkInput({ folderName: 'Bad<Lt>' }))).toThrow();
    expect(() => validateCreate(mkInput({ folderName: 'Bad#Hash' }))).toThrow();
  });

  test('throws when no body provided', () => {
    const input: ZambdaInput = { body: '', headers: { Authorization: 'Bearer x' }, secrets: null };
    expect(() => validateCreate(input)).toThrow();
  });

  test('throws when no Authorization header provided', () => {
    const input: ZambdaInput = {
      body: JSON.stringify({ folderName: 'X' }),
      headers: {} as any,
      secrets: null,
    };
    expect(() => validateCreate(input)).toThrow();
  });
});

describe('rename-custom-folder validateRequestParameters', () => {
  test('accepts a valid input', () => {
    const result = validateRename(mkInput({ internalName: 'custom-folder-foo', newName: 'Foo Renamed' }));
    expect(result.internalName).toBe('custom-folder-foo');
    expect(result.newName).toBe('Foo Renamed');
  });

  test('rejects empty internalName or empty newName', () => {
    expect(() => validateRename(mkInput({ internalName: '', newName: 'Foo' }))).toThrow();
    expect(() => validateRename(mkInput({ internalName: 'custom-folder-foo', newName: '   ' }))).toThrow();
  });

  test('rejects newName with disallowed characters', () => {
    expect(() => validateRename(mkInput({ internalName: 'custom-folder-foo', newName: 'Foo/Slash' }))).toThrow();
  });
});

describe('delete-custom-folder validateRequestParameters', () => {
  test('accepts an internalName', () => {
    const result = validateDelete(mkInput({ internalName: 'custom-folder-foo' }));
    expect(result.internalName).toBe('custom-folder-foo');
  });

  test('rejects empty internalName', () => {
    expect(() => validateDelete(mkInput({ internalName: '' }))).toThrow();
    expect(() => validateDelete(mkInput({ internalName: '   ' }))).toThrow();
  });
});

describe('deriveInternalFolderName', () => {
  test('lowercases, slugifies, prefixes', () => {
    expect(deriveInternalFolderName('After-Visit Care')).toBe(`${CUSTOM_FOLDER_INTERNAL_NAME_PREFIX}after-visit-care`);
    expect(deriveInternalFolderName('Foo  Bar  Baz')).toBe(`${CUSTOM_FOLDER_INTERNAL_NAME_PREFIX}foo-bar-baz`);
  });

  test('strips disallowed characters and collapses dashes', () => {
    expect(deriveInternalFolderName("ABC's & 123")).toBe(`${CUSTOM_FOLDER_INTERNAL_NAME_PREFIX}abcs-123`);
    expect(deriveInternalFolderName('---weird---name---')).toBe(`${CUSTOM_FOLDER_INTERNAL_NAME_PREFIX}weird-name`);
  });

  test('returns empty string when nothing slugifiable remains', () => {
    expect(deriveInternalFolderName('!!!')).toBe('');
    expect(deriveInternalFolderName('   ')).toBe('');
  });
});

describe('parseCustomFoldersCatalog', () => {
  test('returns [] for missing or empty catalog', () => {
    expect(parseCustomFoldersCatalog(undefined)).toEqual([]);
    const empty: List = { resourceType: 'List', status: 'current', mode: 'working' };
    expect(parseCustomFoldersCatalog(empty)).toEqual([]);
  });

  test('returns one entry per catalog entry, dropping malformed ones', () => {
    const catalog: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      entry: [
        { item: { display: 'After-Visit Care', identifier: { value: 'custom-folder-after-visit-care' } } },
        { item: { display: 'Patient Education', identifier: { value: 'custom-folder-patient-education' } } },
        // Missing identifier — should be skipped.
        { item: { display: 'Bad Entry' } },
        // Missing display — should be skipped.
        { item: { identifier: { value: 'custom-folder-no-display' } } },
      ],
    };
    const defs = parseCustomFoldersCatalog(catalog);
    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.internalName)).toEqual([
      'custom-folder-after-visit-care',
      'custom-folder-patient-education',
    ]);
  });

  test('filters out soft-deleted entries by default', () => {
    const catalog: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      entry: [
        { item: { display: 'Active', identifier: { value: 'custom-folder-active' } } },
        {
          flag: {
            coding: [{ system: 'https://fhir.ottehr.com/r4/CodeSystem/custom-folder-entry-flag', code: 'deleted' }],
          },
          item: { display: 'Tombstoned', identifier: { value: 'custom-folder-tombstoned' } },
        },
      ],
    };
    const defs = parseCustomFoldersCatalog(catalog);
    expect(defs).toHaveLength(1);
    expect(defs[0].internalName).toBe('custom-folder-active');
    expect(defs[0].deleted).toBeFalsy();
  });
});

describe('parseCustomFoldersCatalogIncludingDeleted', () => {
  test('returns soft-deleted entries with deleted=true', () => {
    const catalog: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      entry: [
        { item: { display: 'Active', identifier: { value: 'custom-folder-active' } } },
        {
          flag: {
            coding: [{ system: 'https://fhir.ottehr.com/r4/CodeSystem/custom-folder-entry-flag', code: 'deleted' }],
          },
          item: { display: 'Tombstoned', identifier: { value: 'custom-folder-tombstoned' } },
        },
      ],
    };
    const defs = parseCustomFoldersCatalogIncludingDeleted(catalog);
    expect(defs).toHaveLength(2);
    expect(defs.find((d) => d.internalName === 'custom-folder-tombstoned')?.deleted).toBe(true);
    expect(defs.find((d) => d.internalName === 'custom-folder-active')?.deleted).toBe(false);
  });
});

describe('isCustomFolderList', () => {
  test('detects the custom-folder kind coding', () => {
    const customList: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      title: 'custom-folder-foo',
      code: {
        coding: [
          { system: 'https://fhir.zapehr.com/r4/StructureDefinitions', code: 'patient-docs-folder' },
          { system: 'https://fhir.ottehr.com/r4/CodeSystem/folder-kind', code: 'custom' },
        ],
      },
    };
    expect(isCustomFolderList(customList)).toBe(true);
  });

  test('returns false for protected (non-custom) Lists', () => {
    const protectedList: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      title: 'visit-notes',
      code: {
        coding: [{ system: 'https://fhir.zapehr.com/r4/StructureDefinitions', code: 'patient-docs-folder' }],
      },
    };
    expect(isCustomFolderList(protectedList)).toBe(false);
  });
});
