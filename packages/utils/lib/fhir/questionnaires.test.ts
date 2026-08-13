import { QuestionnaireItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { handleFlowQuestionnaireItem } from './questionnaires';

const makeItem = (linkId: string): QuestionnaireItem => ({ linkId, type: 'group' });

describe('handleFlowQuestionnaireItem', () => {
  it('returns items unchanged when no linkId is duplicated', () => {
    const items = [makeItem('page-1'), makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual(items);
  });

  it('returns an empty array unchanged', () => {
    expect(handleFlowQuestionnaireItem([])).toEqual([]);
  });

  it('leaves a single occurrence of a linkId in its original position', () => {
    const page = makeItem('consent-forms-page');
    const items = [page, makeItem('page-1'), makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual(items);
  });

  it('leaves a single occurrence of a linkId in place even when it already trails', () => {
    const page = makeItem('consent-forms-page');
    const items = [makeItem('page-1'), makeItem('page-2'), page];

    expect(handleFlowQuestionnaireItem(items)).toEqual(items);
  });

  it('dedupes a duplicated linkId, keeping only the last occurrence in place', () => {
    const firstPage: QuestionnaireItem = { linkId: 'consent-forms-page', type: 'group', text: 'first' };
    const lastPage: QuestionnaireItem = { linkId: 'consent-forms-page', type: 'group', text: 'last' };
    const items = [firstPage, makeItem('page-1'), lastPage, makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual([makeItem('page-1'), lastPage, makeItem('page-2')]);
  });

  it('dedupes three occurrences of a linkId down to just the last occurrence', () => {
    const page1: QuestionnaireItem = { linkId: 'consent-forms-page', type: 'group', text: '1' };
    const page2: QuestionnaireItem = { linkId: 'consent-forms-page', type: 'group', text: '2' };
    const page3: QuestionnaireItem = { linkId: 'consent-forms-page', type: 'group', text: '3' };
    const items = [page1, makeItem('page-1'), page2, page3, makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual([makeItem('page-1'), page3, makeItem('page-2')]);
  });

  it('dedupes multiple distinct duplicated linkIds independently', () => {
    const firstConsent: QuestionnaireItem = { linkId: 'consent-forms-page', type: 'group', text: 'first' };
    const lastConsent: QuestionnaireItem = { linkId: 'consent-forms-page', type: 'group', text: 'last' };
    const firstInsurance: QuestionnaireItem = { linkId: 'insurance-page', type: 'group', text: 'first' };
    const lastInsurance: QuestionnaireItem = { linkId: 'insurance-page', type: 'group', text: 'last' };
    const items = [firstConsent, firstInsurance, makeItem('page-1'), lastConsent, lastInsurance];

    expect(handleFlowQuestionnaireItem(items)).toEqual([makeItem('page-1'), lastConsent, lastInsurance]);
  });

  it('preserves the relative order of non-duplicated items', () => {
    const items = [makeItem('page-3'), makeItem('page-1'), makeItem('page-2')];

    const result = handleFlowQuestionnaireItem(items);

    expect(result.map((item) => item.linkId)).toEqual(['page-3', 'page-1', 'page-2']);
  });
});
