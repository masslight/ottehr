import { List, ListEntry } from 'fhir/r4b';
import { FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import { CUSTOM_FOLDER_DELETED_FLAG_CODE, CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM } from 'utils/lib/fhir/list';
import { describe, expect, it } from 'vitest';
import { addFolderToCatalog } from '../../src/ehr/create-custom-folder/helpers';
import { renameFolderInCatalog } from '../../src/ehr/rename-custom-folder/helpers';

// These run inside writeCustomFoldersCatalog's mutate, i.e. against every catalog version a write is
// attempted on, so the cases below are the states a concurrent writer can leave between attempts.

const folder = (display: string, internalName: string, deleted = false): ListEntry => ({
  ...(deleted
    ? { flag: { coding: [{ system: CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM, code: CUSTOM_FOLDER_DELETED_FLAG_CODE }] } }
    : {}),
  item: { display, identifier: { value: internalName } },
});

const catalogWith = (...entry: ListEntry[]): List => ({
  resourceType: 'List',
  status: 'current',
  mode: 'working',
  entry,
});

describe('renameFolderInCatalog', () => {
  it('rejects the new name once a concurrent rename gave it to another folder', () => {
    const afterConcurrentRename = catalogWith(folder('A', 'custom-a'), folder('X', 'custom-b'));

    expect(() => renameFolderInCatalog(afterConcurrentRename, 'custom-a', 'x')).toThrow(
      expect.objectContaining({ statusCode: 409 })
    );
  });

  it('answers 404 when a concurrent delete tombstoned the folder', () => {
    const afterConcurrentDelete = catalogWith(folder('A', 'custom-a', true));

    expect(() => renameFolderInCatalog(afterConcurrentDelete, 'custom-a', 'X')).toThrow(
      expect.objectContaining({ statusCode: 404 })
    );
  });

  it('answers 404 before checking the name against system folders', () => {
    expect(() => renameFolderInCatalog(catalogWith(), 'custom-missing', FOLDERS_CONFIG[0].display)).toThrow(
      expect.objectContaining({ statusCode: 404 })
    );
  });

  it('rejects a system folder name', () => {
    expect(() =>
      renameFolderInCatalog(catalogWith(folder('A', 'custom-a')), 'custom-a', FOLDERS_CONFIG[0].display)
    ).toThrow(expect.objectContaining({ statusCode: 409 }));
  });

  it('takes a name only a soft-deleted folder holds, and changes nothing else', () => {
    const catalog = catalogWith(folder('A', 'custom-a'), folder('X', 'custom-x', true));

    expect(renameFolderInCatalog(catalog, 'custom-a', 'X').entry).toEqual([
      folder('X', 'custom-a'),
      folder('X', 'custom-x', true),
    ]);
  });
});

describe('addFolderToCatalog', () => {
  it('rejects the name once a concurrent create added it', () => {
    const afterConcurrentCreate = catalogWith(folder('Labs', 'custom-labs'));

    expect(() => addFolderToCatalog(afterConcurrentCreate, 'labs', 'custom-labs')).toThrow(
      expect.objectContaining({ statusCode: 409 })
    );
  });

  it('rejects a name whose internal name an active folder already uses', () => {
    expect(() => addFolderToCatalog(catalogWith(folder('Lab-s', 'custom-labs')), 'Labs', 'custom-labs')).toThrow(
      expect.objectContaining({ statusCode: 409 })
    );
  });

  it('brings back a soft-deleted folder with the new display name', () => {
    expect(addFolderToCatalog(catalogWith(folder('labs', 'custom-labs', true)), 'Labs', 'custom-labs').entry).toEqual([
      folder('Labs', 'custom-labs'),
    ]);
  });

  it('appends a new folder', () => {
    expect(addFolderToCatalog(catalogWith(folder('A', 'custom-a')), 'Labs', 'custom-labs').entry).toEqual([
      folder('A', 'custom-a'),
      folder('Labs', 'custom-labs'),
    ]);
  });
});
