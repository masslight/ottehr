import { FilterOptionsState } from '@mui/material/useAutocomplete';
import { filterLabOptions } from 'src/features/external-labs/utils/filterLabOptions';
import { nameLabTest } from 'utils/lib/helpers/labs/helpers';
import { STATIC_COMPENDIUM_LAB_GUID } from 'utils/lib/types/data/labs/labs.constants';
import { ModifiedOrderingLocation, OrderableItemSearchResult } from 'utils/lib/types/data/labs/labs.types';
import { describe, expect, it } from 'vitest';

const QUEST = { labGuid: 'quest-guid', labName: 'Quest Diagnostics' };
const LABCORP = { labGuid: 'labcorp-guid', labName: 'LabCorp' };
const AUTOLAB = { labGuid: 'autolab-guid', labName: 'AutoLab' };

const makeOption = (
  itemName: string,
  itemCode: string,
  lab: { labGuid: string; labName: string }
): OrderableItemSearchResult => ({
  item: {
    itemCode,
    itemLoinc: '',
    itemType: '',
    itemName,
    uniqueName: `${itemCode}-${itemName}`,
    specimens: [],
    components: [],
    cptCodes: [],
    aoe: null,
  },
  lab: { ...lab, labType: '', compendiumVersion: '' },
});

// same label the autocomplete renders, so the default MUI matching behaves as it does in the app
const stateFor = (inputValue: string): FilterOptionsState<OrderableItemSearchResult> => ({
  inputValue,
  getOptionLabel: (option) => nameLabTest(option.item.itemName, option.item.itemCode, option.lab.labName, false),
});

const locationWithLabs = (...labs: { labGuid?: string; labName?: string }[]): ModifiedOrderingLocation => ({
  name: 'Main Clinic',
  id: 'location-1',
  enabledLabs: labs.map((lab, idx) => ({ accountNumber: `acct-${idx}`, labOrgRef: `Organization/${idx}`, ...lab })),
});

const questTsh = makeOption('TSH', '1001', QUEST);
const labCorpTsh = makeOption('TSH', '2001', LABCORP);
const questCbc = makeOption('CBC', '1002', QUEST);
const autoLabCbcAutoDiff = makeOption('CBC W Auto Differential panel in Blood', '3001', AUTOLAB);
const autoLabUrinalysis = makeOption('Urinalysis', '3002', AUTOLAB);
const questAutoimmune = makeOption('Autoimmune panel', '1003', QUEST);

describe('filterLabOptions', () => {
  it('filters like the default autocomplete when the input names no lab', () => {
    const options = [questTsh, labCorpTsh, questCbc];
    expect(filterLabOptions(options, stateFor('tsh'), [])).toEqual([questTsh, labCorpTsh]);
  });

  it('keeps only the named lab when a test name is followed by a lab name', () => {
    const options = [questTsh, labCorpTsh, questCbc];
    expect(filterLabOptions(options, stateFor('TSH quest'), [])).toEqual([questTsh]);
  });

  it('shows everything at the lab when the input is only a lab name', () => {
    const options = [questTsh, autoLabCbcAutoDiff, autoLabUrinalysis];
    expect(filterLabOptions(options, stateFor('autol'), [])).toEqual([autoLabCbcAutoDiff, autoLabUrinalysis]);
  });

  it('recognises a configured lab even when it has no results', () => {
    // Quest returned no TSH, so "quest" only reads as a lab word because it is configured at a location
    const options = [labCorpTsh];
    const orderingLocations = [locationWithLabs(QUEST, LABCORP)];

    expect(filterLabOptions(options, stateFor('TSH quest labcorp'), orderingLocations)).toEqual([labCorpTsh]);
    // without the configured labs, "quest" becomes a test word and the LabCorp result is hidden
    expect(filterLabOptions(options, stateFor('TSH quest labcorp'), [])).toEqual([]);
  });

  it('ignores configured labs missing a guid', () => {
    // Quest has a name but no guid (its Organization had no lab guid), so "quest" is not a lab word here
    // and the LabCorp result is hidden, unlike when Quest is fully configured
    const options = [labCorpTsh];
    const orderingLocations = [locationWithLabs({ labName: QUEST.labName }, LABCORP)];
    expect(filterLabOptions(options, stateFor('TSH quest labcorp'), orderingLocations)).toEqual([]);
  });

  it('narrows static compendium results to the named generic lab', () => {
    const acme = { labGuid: STATIC_COMPENDIUM_LAB_GUID, labName: 'Acme Labs' };
    const beta = { labGuid: STATIC_COMPENDIUM_LAB_GUID, labName: 'Beta Labs' };
    const acmeTsh = makeOption('TSH', '9001', acme);
    const betaTsh = makeOption('TSH', '9001', beta);

    expect(filterLabOptions([acmeTsh, betaTsh], stateFor('TSH acme'), [locationWithLabs(acme, beta)])).toEqual([
      acmeTsh,
    ]);
  });

  describe('a lab-looking word is read both as a lab and as part of the test name', () => {
    it('keeps an exact match on the whole input even though a word in it names a lab', () => {
      // "auto" names AutoLab, leaving "CBC W Differential panel in Blood", which is not in the label
      const options = [autoLabCbcAutoDiff, questCbc];
      expect(filterLabOptions(options, stateFor('CBC W Auto Differential panel in Blood'), [])).toEqual([
        autoLabCbcAutoDiff,
      ]);
    });

    it('lists named-lab matches first, then whole-input matches from other labs', () => {
      const options = [questAutoimmune, autoLabCbcAutoDiff, autoLabUrinalysis];
      expect(filterLabOptions(options, stateFor('auto'), [])).toEqual([
        autoLabCbcAutoDiff,
        autoLabUrinalysis,
        questAutoimmune,
      ]);
    });

    it('never lists an option twice when it matches both ways', () => {
      // every AutoLab label ends in "/ AutoLab", so all of them match "auto" both as a lab and as text
      const options = [autoLabCbcAutoDiff, autoLabUrinalysis];
      const result = filterLabOptions(options, stateFor('auto'), []);
      expect(result).toEqual([autoLabCbcAutoDiff, autoLabUrinalysis]);
      expect(new Set(result).size).toBe(result.length);
    });
  });
});
