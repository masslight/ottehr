import { QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { IN_PERSON_INTAKE_PAPERWORK_URL } from '../ottehr-config/intake-paperwork';
import { VIRTUAL_INTAKE_PAPERWORK_URL } from '../ottehr-config/intake-paperwork-virtual';
import { INTAKE_PAPERWORK_QR_TAG } from './constants';
import {
  handleFlowQuestionnaireItem,
  isIntakePaperworkQuestionnaireResponse,
  isOttehrManagedIntakeQuestionnaire,
} from './questionnaires';

const makeItem = (linkId: string): QuestionnaireItem => ({ linkId, type: 'group' });

const makeQR = (overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  status: 'completed',
  ...overrides,
});

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

describe('isOttehrManagedIntakeQuestionnaire', () => {
  it('returns true for an in-person intake paperwork url', () => {
    expect(isOttehrManagedIntakeQuestionnaire(IN_PERSON_INTAKE_PAPERWORK_URL)).toBe(true);
  });

  it('returns true for an in-person intake paperwork url with a version suffix', () => {
    expect(isOttehrManagedIntakeQuestionnaire(`${IN_PERSON_INTAKE_PAPERWORK_URL}|1.0.0`)).toBe(true);
  });

  it('returns true for a virtual intake paperwork url', () => {
    expect(isOttehrManagedIntakeQuestionnaire(VIRTUAL_INTAKE_PAPERWORK_URL)).toBe(true);
  });

  it('returns true for a virtual intake paperwork url with a version suffix', () => {
    expect(isOttehrManagedIntakeQuestionnaire(`${VIRTUAL_INTAKE_PAPERWORK_URL}|2.3.0`)).toBe(true);
  });

  it('returns false for an unrelated questionnaire url', () => {
    expect(isOttehrManagedIntakeQuestionnaire('https://ottehr.com/FHIR/Questionnaire/patient-record')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isOttehrManagedIntakeQuestionnaire('')).toBe(false);
  });
});

describe('isIntakePaperworkQuestionnaireResponse', () => {
  it('returns true when meta.tag contains the intake paperwork tag, regardless of the canonical url', () => {
    const qr = makeQR({
      questionnaire: 'https://ottehr.com/FHIR/Questionnaire/some-flow-canonical|1.0.0',
      meta: { tag: [{ system: INTAKE_PAPERWORK_QR_TAG.system, code: INTAKE_PAPERWORK_QR_TAG.code }] },
    });

    expect(isIntakePaperworkQuestionnaireResponse(qr)).toBe(true);
  });

  it('returns true when the intake tag is present alongside unrelated tags', () => {
    const qr = makeQR({
      meta: {
        tag: [
          { system: 'https://example.com/other-tag-system', code: 'other-code' },
          { system: INTAKE_PAPERWORK_QR_TAG.system, code: INTAKE_PAPERWORK_QR_TAG.code },
        ],
      },
    });

    expect(isIntakePaperworkQuestionnaireResponse(qr)).toBe(true);
  });

  it('returns false when meta.tag has a matching system but a different code', () => {
    const qr = makeQR({
      meta: { tag: [{ system: INTAKE_PAPERWORK_QR_TAG.system, code: 'not-intake-paperwork' }] },
    });

    expect(isIntakePaperworkQuestionnaireResponse(qr)).toBe(false);
  });

  it('returns false when there is no tag and no questionnaire canonical', () => {
    expect(isIntakePaperworkQuestionnaireResponse(makeQR())).toBe(false);
  });

  it('returns true when there is no tag but the questionnaire canonical is the in-person intake paperwork url', () => {
    const qr = makeQR({ questionnaire: `${IN_PERSON_INTAKE_PAPERWORK_URL}|1.0.0` });

    expect(isIntakePaperworkQuestionnaireResponse(qr)).toBe(true);
  });

  it('returns true when there is no tag but the questionnaire canonical is the virtual intake paperwork url', () => {
    const qr = makeQR({ questionnaire: `${VIRTUAL_INTAKE_PAPERWORK_URL}|1.0.0` });

    expect(isIntakePaperworkQuestionnaireResponse(qr)).toBe(true);
  });

  it('returns false when there is no tag and the questionnaire canonical does not match a known intake url', () => {
    const qr = makeQR({ questionnaire: 'https://ottehr.com/FHIR/Questionnaire/some-flow-canonical|1.0.0' });

    expect(isIntakePaperworkQuestionnaireResponse(qr)).toBe(false);
  });
});
