import { List } from 'fhir/r4b';
import { FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import { parseCustomFoldersCatalogIncludingDeleted } from 'utils/lib/fhir/list';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';

export const renameFolderInCatalog = (catalog: List, internalName: string, newName: string): List => {
  const defs = parseCustomFoldersCatalogIncludingDeleted(catalog);

  const target = defs.find((d) => d.internalName === internalName);
  if (!target) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }
  // Soft-deleted (tombstoned) entries are read-only — admin must re-create the
  // folder (which clears the tombstone) before they can rename it.
  if (target.deleted) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }

  // Uniqueness check: newName must not match any system folder display or another
  // active custom folder. Soft-deleted entries don't reserve display names.
  const systemDisplayNames = FOLDERS_CONFIG.map((f) => f.display.toLowerCase().trim());
  if (systemDisplayNames.includes(newName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${newName}" already exists`), statusCode: 409 };
  }

  const otherCustomNames = defs
    .filter((d) => d.internalName !== internalName && !d.deleted)
    .map((d) => d.displayName.toLowerCase().trim());
  if (otherCustomNames.includes(newName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${newName}" already exists`), statusCode: 409 };
  }

  return {
    ...catalog,
    entry: (catalog.entry ?? []).map((entry) =>
      entry.item?.identifier?.value === internalName ? { ...entry, item: { ...entry.item, display: newName } } : entry
    ),
  };
};
