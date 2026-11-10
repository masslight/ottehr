import { describe, expect, it } from 'vitest';
import { parseLabSearch } from './lab-search';

const quest = { labGuid: 'quest-guid', labName: 'Quest Diagnostics' };
const pathGroup = { labGuid: 'pathgroup-guid', labName: 'PathGroup' };
const labCorp = { labGuid: 'labcorp-guid', labName: 'Lab Corp' };
const acme = { labGuid: 'acme-guid', labName: 'Acme Diagnostics' };
const labs = [quest, pathGroup, labCorp, acme];

describe('parseLabSearch', () => {
  it('leaves a search with no lab name untouched', () => {
    expect(parseLabSearch('  TSH free  ', labs)).toEqual({ testSearch: 'TSH free', matchedLabs: [] });
  });

  it('pulls a lab name off the end of the search', () => {
    expect(parseLabSearch('TSH quest', labs)).toEqual({ testSearch: 'TSH', matchedLabs: [quest] });
  });

  it('matches the start of a lab name, case-insensitively, wherever the word sits', () => {
    expect(parseLabSearch('PATH tsh', labs)).toEqual({ testSearch: 'tsh', matchedLabs: [pathGroup] });
  });

  it('matches a lab name typed without its spaces', () => {
    expect(parseLabSearch('cbc labcorp', labs)).toEqual({ testSearch: 'cbc', matchedLabs: [labCorp] });
  });

  it('matches a one-word lab name typed with spaces', () => {
    const labCorpOneWord = { labGuid: 'labcorp-guid', labName: 'LabCorp' };
    expect(parseLabSearch('lab corp', [quest, labCorpOneWord])).toEqual({
      testSearch: '',
      matchedLabs: [labCorpOneWord],
    });
    expect(parseLabSearch('cbc lab corp', [quest, labCorpOneWord])).toEqual({
      testSearch: 'cbc',
      matchedLabs: [labCorpOneWord],
    });
  });

  it('prefers labs matching every lab word', () => {
    expect(parseLabSearch('TSH quest diagnostics', labs)).toEqual({ testSearch: 'TSH', matchedLabs: [quest] });
  });

  it('keeps every lab named when no single lab matches all lab words', () => {
    expect(parseLabSearch('TSH quest labcorp', labs)).toEqual({ testSearch: 'TSH', matchedLabs: [quest, labCorp] });
  });

  it('treats even a single letter as a lab word when it starts a lab name', () => {
    expect(parseLabSearch('TSH q', labs)).toEqual({ testSearch: 'TSH', matchedLabs: [quest] });
    expect(parseLabSearch('TSH a', labs)).toEqual({ testSearch: 'TSH', matchedLabs: [acme] });
  });

  it('never treats punctuation-only words as lab words', () => {
    expect(parseLabSearch('TSH / -', labs)).toEqual({ testSearch: 'TSH / -', matchedLabs: [] });
  });

  it('treats a search made only of lab words as a search of everything at that lab', () => {
    const autolab = { labGuid: 'autolab-guid', labName: 'Autolab' };
    expect(parseLabSearch('aut', [...labs, autolab])).toEqual({ testSearch: '', matchedLabs: [autolab] });
    expect(parseLabSearch('auto', [...labs, autolab])).toEqual({ testSearch: '', matchedLabs: [autolab] });
  });
});
