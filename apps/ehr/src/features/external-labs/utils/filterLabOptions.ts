import { createFilterOptions, FilterOptionsState } from '@mui/material/useAutocomplete';
import { parseLabSearch } from 'utils/lib/helpers/labs/lab-search';
import { STATIC_COMPENDIUM_LAB_GUID } from 'utils/lib/types/data/labs/labs.constants';
import { ModifiedOrderingLocation, OrderableItemSearchResult } from 'utils/lib/types/data/labs/labs.types';

const defaultLabOptionsFilter = createFilterOptions<OrderableItemSearchResult>();

/**
 * The input may include a lab name ("TSH quest"), which the default filter would never find
 * in an option label. Strip the lab words, keep only options from the named labs (this also narrows
 * static compendium results expanded into each generic lab), then filter on the test words as usual.
 *
 * Like the server, a lab-looking word is read both ways, since it may be the start of a test name
 * ("auto" is Autolab but also "Automated differential"): options matching the whole input as usual
 * are kept too, after the named-lab ones.
 */
export const filterLabOptions = (
  options: OrderableItemSearchResult[],
  state: FilterOptionsState<OrderableItemSearchResult>,
  orderingLocations: ModifiedOrderingLocation[]
): OrderableItemSearchResult[] => {
  const configuredLabs = orderingLocations.flatMap((location) =>
    location.enabledLabs.flatMap(({ labGuid, labName }) => (labGuid && labName ? [{ labGuid, labName }] : []))
  );
  const labsInOptions = options.map((option) => option.lab);
  // dedupe on guid and name together:
  // two labs can share a name with different guids (theoretically, in practice I haven't seen this happen)
  // generic labs share a guid with different names, and every one of them has to stay matchable
  const candidateLabs = [
    ...new Map([...configuredLabs, ...labsInOptions].map((lab) => [`${lab.labGuid}|${lab.labName}`, lab])).values(),
  ];
  const { testSearch, matchedLabs } = parseLabSearch(state.inputValue, candidateLabs);
  if (!matchedLabs.length) return defaultLabOptionsFilter(options, state);

  // Match options to the named labs by guid, so it doesn't matter whether a lab is called by its Organization
  // name or the name the lab API puts on its items ("Quest" vs "Quest Diagnostics"). Generic labs all share the
  // static compendium guid, so those can only be told apart by name (the Organization name, which
  // expandResultsForGeneric puts on each copy).
  const isStaticCompendium = (lab: { labGuid: string }): boolean => lab.labGuid === STATIC_COMPENDIUM_LAB_GUID;
  const matchedLabGuids = new Set(matchedLabs.filter((lab) => !isStaticCompendium(lab)).map((lab) => lab.labGuid));
  const matchedGenericLabNames = new Set(matchedLabs.filter(isStaticCompendium).map((lab) => lab.labName));
  const isFromNamedLab = (option: OrderableItemSearchResult): boolean =>
    isStaticCompendium(option.lab)
      ? matchedGenericLabNames.has(option.lab.labName)
      : matchedLabGuids.has(option.lab.labGuid);

  const namedLabOptions = defaultLabOptionsFilter(options.filter(isFromNamedLab), {
    ...state,
    inputValue: testSearch,
  });
  const namedLabOptionSet = new Set(namedLabOptions);
  const wholeInputOptions = defaultLabOptionsFilter(options, state).filter((option) => !namedLabOptionSet.has(option));
  return [...namedLabOptions, ...wholeInputOptions];
};
