import { UCGetPaperworkResponse } from 'utils/lib/types/data/paperwork/paperwork.types';
import { describe, expect, it } from 'vitest';
import { resolveConditionPhotoState } from './conditionPhotoState';

const makeData = (overrides: Partial<UCGetPaperworkResponse>): UCGetPaperworkResponse =>
  ({
    allItems: [],
    questionnaireResponse: { resourceType: 'QuestionnaireResponse', status: 'in-progress' },
    ...overrides,
  }) as unknown as UCGetPaperworkResponse;

const conditionPageWithPhoto = (
  url: string
): NonNullable<UCGetPaperworkResponse['questionnaireResponse']['item']>[number] => ({
  linkId: 'patient-condition-page',
  item: [{ linkId: 'patient-photos', answer: [{ valueAttachment: { url, title: 'from-qr' } }] }],
});

describe('resolveConditionPhotoState', () => {
  describe('when patient-condition-page is a step in the questionnaire', () => {
    it('reads the photo from the QuestionnaireResponse and does not expose a documentReferenceId', () => {
      const data = makeData({
        allItems: [{ linkId: 'patient-condition-page' }] as UCGetPaperworkResponse['allItems'],
        questionnaireResponse: {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          item: [conditionPageWithPhoto('qr-photo-url')],
        } as UCGetPaperworkResponse['questionnaireResponse'],
      });

      const state = resolveConditionPhotoState(data);

      expect(state.hasConditionStep).toBe(true);
      expect(state.attachment?.url).toBe('qr-photo-url');
      expect(state.documentReferenceId).toBeUndefined();
    });

    it('reports no photo when the QR step has no attachment', () => {
      const data = makeData({
        allItems: [{ linkId: 'patient-condition-page' }] as UCGetPaperworkResponse['allItems'],
        questionnaireResponse: {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          item: [{ linkId: 'patient-condition-page', item: [{ linkId: 'patient-photos' }] }],
        } as UCGetPaperworkResponse['questionnaireResponse'],
      });

      const state = resolveConditionPhotoState(data);

      expect(state.hasConditionStep).toBe(true);
      expect(state.attachment).toBeUndefined();
    });

    it('ignores DocumentReference photos when the step exists (QR is the source of truth)', () => {
      const data = makeData({
        allItems: [{ linkId: 'patient-condition-page' }] as UCGetPaperworkResponse['allItems'],
        questionnaireResponse: {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          item: [conditionPageWithPhoto('qr-photo-url')],
        } as UCGetPaperworkResponse['questionnaireResponse'],
        patientConditionPhotos: [{ documentReferenceId: 'doc-1', url: 'docref-url', title: 'from-docref' }],
      });

      const state = resolveConditionPhotoState(data);

      expect(state.hasConditionStep).toBe(true);
      expect(state.attachment?.url).toBe('qr-photo-url');
      expect(state.documentReferenceId).toBeUndefined();
    });
  });

  describe('when patient-condition-page is absent from the questionnaire', () => {
    it('reads the photo from the DocumentReference and exposes its id for deletion', () => {
      const data = makeData({
        allItems: [{ linkId: 'contact-information-page' }] as UCGetPaperworkResponse['allItems'],
        patientConditionPhotos: [{ documentReferenceId: 'doc-1', url: 'docref-url', title: 'from-docref' }],
      });

      const state = resolveConditionPhotoState(data);

      expect(state.hasConditionStep).toBe(false);
      expect(state.attachment?.url).toBe('docref-url');
      expect(state.documentReferenceId).toBe('doc-1');
    });

    it('reports no photo when there is no DocumentReference', () => {
      const data = makeData({
        allItems: [{ linkId: 'contact-information-page' }] as UCGetPaperworkResponse['allItems'],
        patientConditionPhotos: [],
      });

      const state = resolveConditionPhotoState(data);

      expect(state.hasConditionStep).toBe(false);
      expect(state.attachment).toBeUndefined();
      expect(state.documentReferenceId).toBeUndefined();
    });

    it('does not read a stale QR answer when the step is gone', () => {
      const data = makeData({
        allItems: [] as UCGetPaperworkResponse['allItems'],
        questionnaireResponse: {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          item: [conditionPageWithPhoto('stale-qr-url')],
        } as UCGetPaperworkResponse['questionnaireResponse'],
        patientConditionPhotos: [],
      });

      const state = resolveConditionPhotoState(data);

      expect(state.hasConditionStep).toBe(false);
      expect(state.attachment).toBeUndefined();
    });
  });
});
