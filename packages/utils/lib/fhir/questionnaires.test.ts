import { QuestionnaireItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { CONSENT_FORMS_PAGE_LINK_ID } from './constants';
import { handleFlowQuestionnaireItem } from './questionnaires';

const makeItem = (linkId: string): QuestionnaireItem => ({ linkId, type: 'group' });

describe('handleFlowQuestionnaireItem', () => {
  it('returns items unchanged when no consent-forms page is present', () => {
    const items = [makeItem('page-1'), makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual(items);
  });

  it('returns an empty array unchanged', () => {
    expect(handleFlowQuestionnaireItem([])).toEqual([]);
  });

  it('leaves a single consent-forms page in its original position', () => {
    const consentPage = makeItem(CONSENT_FORMS_PAGE_LINK_ID);
    const items = [consentPage, makeItem('page-1'), makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual(items);
  });

  it('leaves a single consent-forms page in place even when it already trails', () => {
    const consentPage = makeItem(CONSENT_FORMS_PAGE_LINK_ID);
    const items = [makeItem('page-1'), makeItem('page-2'), consentPage];

    expect(handleFlowQuestionnaireItem(items)).toEqual(items);
  });

  it('dedupes multiple consent-forms pages, keeping only the last occurrence in place', () => {
    const firstConsentPage: QuestionnaireItem = { linkId: CONSENT_FORMS_PAGE_LINK_ID, type: 'group', text: 'first' };
    const lastConsentPage: QuestionnaireItem = { linkId: CONSENT_FORMS_PAGE_LINK_ID, type: 'group', text: 'last' };
    const items = [firstConsentPage, makeItem('page-1'), lastConsentPage, makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual([makeItem('page-1'), lastConsentPage, makeItem('page-2')]);
  });

  it('dedupes three consent-forms pages down to just the last occurrence', () => {
    const consentPage1: QuestionnaireItem = { linkId: CONSENT_FORMS_PAGE_LINK_ID, type: 'group', text: '1' };
    const consentPage2: QuestionnaireItem = { linkId: CONSENT_FORMS_PAGE_LINK_ID, type: 'group', text: '2' };
    const consentPage3: QuestionnaireItem = { linkId: CONSENT_FORMS_PAGE_LINK_ID, type: 'group', text: '3' };
    const items = [consentPage1, makeItem('page-1'), consentPage2, consentPage3, makeItem('page-2')];

    expect(handleFlowQuestionnaireItem(items)).toEqual([makeItem('page-1'), consentPage3, makeItem('page-2')]);
  });

  it('preserves the relative order of non-consent items', () => {
    const items = [makeItem('page-3'), makeItem('page-1'), makeItem('page-2')];

    const result = handleFlowQuestionnaireItem(items);

    expect(result.map((item) => item.linkId)).toEqual(['page-3', 'page-1', 'page-2']);
  });
});
