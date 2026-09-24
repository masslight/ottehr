import { Questionnaire } from 'fhir/r4b';
import { QR_DISTRIBUTION_TAG } from 'utils/lib/fhir/constants';
import { qrSentManually } from 'utils/lib/helpers/practice-managed-questionnaires';
import { describe, expect, it } from 'vitest';
import { stubPaperworkResponseForPreview } from './previewStubs';

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/preview-stubs-test',
  version: '2.0.0',
  status: 'active',
  item: [
    {
      linkId: 'contact-page',
      text: 'Contact information',
      type: 'group',
      item: [
        {
          linkId: 'patient-email',
          text: 'Email',
          type: 'string',
          extension: [{ url: 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type', valueString: 'Email' }],
        },
      ],
    },
  ],
};

describe('stubPaperworkResponseForPreview', () => {
  it('leaves the questionnaire it is given unchanged', () => {
    const before = structuredClone(questionnaire);

    stubPaperworkResponseForPreview(questionnaire);

    expect(questionnaire).toEqual(before);
  });

  it('builds an empty response per page, tagged as a one-off form, for the questionnaire version', () => {
    const { questionnaireResponse, questionnaireTitle } = stubPaperworkResponseForPreview(questionnaire);

    expect(questionnaireResponse.questionnaire).toBe('https://ottehr.com/FHIR/Questionnaire/preview-stubs-test|2.0.0');
    expect(questionnaireResponse.item).toEqual([{ linkId: 'contact-page', item: [] }]);
    expect(questionnaireResponse.meta?.tag).toEqual([QR_DISTRIBUTION_TAG]);
    expect(qrSentManually(questionnaireResponse)).toBe(true);
    expect(questionnaireTitle).toBe('Form');
  });
});
