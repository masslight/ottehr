import { QuestionnaireDataTypes } from 'config-types';
import { pageHarvestStrategy } from 'config-types';
import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../fhir/constants';

const DATA_TYPE_EXTENSION_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType;

/**
 * Top-level page linkIds the harvest module reads. A questionnaire that has one of these pages will
 * have its answers harvested into FHIR resources by `sub-harvest-paperwork`, so removing/renaming the
 * page (or its fields) silently detaches data from the EHR. Source of truth: `pageHarvestStrategy`.
 */
export const HARVEST_PAGE_LINK_IDS: ReadonlySet<string> = new Set(Object.keys(pageHarvestStrategy));

interface HarvestRelevantItem {
  linkId: string;
  type: QuestionnaireItem['type'];
  dataType: string | undefined;
}

const getDataTypeExtensionValue = (item: QuestionnaireItem): string | undefined =>
  item.extension?.find((ext) => ext.url === DATA_TYPE_EXTENSION_URL)?.valueString;

/**
 * Recursively collects every descendant item under a page that harvest could depend on: groups (which
 * carry structural meaning, e.g. DOB / insurance-section) and non-display input fields. `display` items
 * are excluded because they hold no answers and are safe to change.
 */
const collectHarvestRelevantItems = (items: QuestionnaireItem[] | undefined): HarvestRelevantItem[] => {
  if (!items) return [];
  return items.flatMap((item) => {
    const self: HarvestRelevantItem[] =
      item.type === 'display' || !item.linkId
        ? []
        : [{ linkId: item.linkId, type: item.type, dataType: getDataTypeExtensionValue(item) }];
    return [...self, ...collectHarvestRelevantItems(item.item)];
  });
};

/** Human-readable data-type label for error messages. */
const describeDataType = (dataType: string | undefined): string =>
  dataType && (QuestionnaireDataTypes as readonly string[]).includes(dataType) ? dataType : dataType ?? 'none';

/**
 * Differential harvest-safety check: compares an imported next-version questionnaire against the current
 * active one and flags changes that would break harvesting. For every harvest page present in `current`,
 * the same page must remain a group in `imported`, and every harvest-relevant item under it must remain
 * present with an unchanged FHIR `type` and unchanged `data-type`. Returns a list of specific error
 * messages (empty when safe). If `current` has no harvest pages this is a no-op.
 */
export const harvestRegressions = (current: Questionnaire, imported: Questionnaire): string[] => {
  const errors: string[] = [];

  const currentHarvestPages = (current.item ?? []).filter((page) => HARVEST_PAGE_LINK_IDS.has(page.linkId));
  if (currentHarvestPages.length === 0) return errors;

  const importedPagesByLinkId = new Map((imported.item ?? []).map((page) => [page.linkId, page]));

  for (const currentPage of currentHarvestPages) {
    const importedPage = importedPagesByLinkId.get(currentPage.linkId);

    if (!importedPage) {
      errors.push(
        `Harvest page "${currentPage.linkId}" is missing from the imported questionnaire. The harvest module reads this page, so removing it would break data collection.`
      );
      continue;
    }
    if (importedPage.type !== 'group') {
      errors.push(
        `Harvest page "${currentPage.linkId}" must remain a group, but was imported as type "${importedPage.type}".`
      );
      continue;
    }

    const importedItems = new Map(collectHarvestRelevantItems(importedPage.item).map((i) => [i.linkId, i]));

    for (const currentItem of collectHarvestRelevantItems(currentPage.item)) {
      const importedItem = importedItems.get(currentItem.linkId);
      if (!importedItem) {
        errors.push(
          `Harvest field "${currentItem.linkId}" (page "${currentPage.linkId}") was removed. The harvest module reads this field, so it must be preserved.`
        );
        continue;
      }
      if (importedItem.type !== currentItem.type) {
        errors.push(
          `Harvest field "${currentItem.linkId}" changed type from "${currentItem.type}" to "${importedItem.type}". Harvesting expects the original answer type.`
        );
      }
      if (importedItem.dataType !== currentItem.dataType) {
        errors.push(
          `Harvest field "${currentItem.linkId}" changed data-type from "${describeDataType(
            currentItem.dataType
          )}" to "${describeDataType(importedItem.dataType)}". Harvesting expects the original data type.`
        );
      }
    }
  }

  return errors;
};
