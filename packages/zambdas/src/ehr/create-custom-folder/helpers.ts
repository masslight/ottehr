import { List } from 'fhir/r4b';
import { parseCustomFoldersCatalogIncludingDeleted } from 'utils/lib/fhir/list';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';

// Either insert a new entry, or clear the tombstone on an existing soft-deleted
// entry with the same internalName (refreshing its display to the newly-supplied
// folderName so any case/punctuation tweak the admin made on re-create is honored).
export const addFolderToCatalog = (catalog: List, folderName: string, internalName: string): List => {
  const allDefs = parseCustomFoldersCatalogIncludingDeleted(catalog);

  const lowerName = folderName.toLowerCase().trim();
  const visibleDefs = allDefs.filter((d) => !d.deleted);
  if (visibleDefs.some((d) => d.displayName.toLowerCase().trim() === lowerName)) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${folderName}" already exists`), statusCode: 409 };
  }

  const sameInternal = allDefs.find((d) => d.internalName === internalName);
  if (sameInternal && !sameInternal.deleted) {
    throw {
      ...INVALID_INPUT_ERROR(`A folder with a similar name already exists`),
      statusCode: 409,
    };
  }

  const entries = catalog.entry ?? [];
  const existingIdx = entries.findIndex((e) => e.item?.identifier?.value === internalName);
  if (existingIdx >= 0) {
    const existing = entries[existingIdx];
    // Strip the soft-delete tombstone marker (entry.flag) when resurrecting.
    const { flag: _flag, ...rest } = existing;
    void _flag;
    const updated = {
      ...rest,
      item: { ...existing.item, display: folderName, identifier: { value: internalName } },
    };
    return { ...catalog, entry: entries.map((e, i) => (i === existingIdx ? updated : e)) };
  }
  const newEntry = {
    item: {
      display: folderName,
      identifier: { value: internalName },
    },
  };
  return { ...catalog, entry: [...entries, newEntry] };
};
