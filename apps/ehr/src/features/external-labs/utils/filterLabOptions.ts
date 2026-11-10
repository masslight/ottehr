import { createFilterOptions, FilterOptionsState } from '@mui/material/useAutocomplete';
import { parseLabSearch } from 'utils/lib/helpers/labs/lab-search';
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
  const candidateLabs = [...new Map([...configuredLabs, ...labsInOptions].map((lab) => [lab.labName, lab])).values()];
  const { testSearch, matchedLabs } = parseLabSearch(state.inputValue, candidateLabs);
  if (!matchedLabs.length) return defaultLabOptionsFilter(options, state);

  const matchedLabNames = new Set(matchedLabs.map((lab) => lab.labName));
  const namedLabOptions = defaultLabOptionsFilter(
    options.filter((option) => matchedLabNames.has(option.lab.labName)),
    { ...state, inputValue: testSearch }
  );
  const namedLabOptionSet = new Set(namedLabOptions);
  const wholeInputOptions = defaultLabOptionsFilter(options, state).filter((option) => !namedLabOptionSet.has(option));
  return [...namedLabOptions, ...wholeInputOptions];
};
