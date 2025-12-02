import { z } from 'zod';
import { LEGAL_OVERRIDES as OVERRIDES } from '../../../.ottehr_config';
import { mergeAndFreezeConfigObjects } from '../helpers';
import { TextWithLinkComposition } from '../types';

console.log('LEGAL OVERRIDES:', OVERRIDES);

export type LegalConfigSchemaType = Record<string, TextWithLinkComposition>;

const LEGAL_DEFAULTS: LegalConfigSchemaType = {
  REVIEW_PAGE: [
    {
      keyPath: 'reviewAndSubmit.byProceeding',
      nodeType: 'DisplayText',
    },
    {
      url: '/template.pdf',
      textToDisplay: { keyPath: 'reviewAndSubmit.privacyPolicy', nodeType: 'DisplayText' },
      testId: 'privacy-policy-review-screen',
      nodeType: 'Link',
    },
    {
      keyPath: 'reviewAndSubmit.andPrivacyPolicy',
      nodeType: 'DisplayText',
    },
    {
      url: '/template.pdf',
      textToDisplay: { keyPath: 'reviewAndSubmit.termsAndConditions', nodeType: 'DisplayText' },
      testId: 'terms-conditions-review-screen',
      nodeType: 'Link',
    },
  ],
};

const mergedLegalConfig = mergeAndFreezeConfigObjects({ ...LEGAL_DEFAULTS }, { ...OVERRIDES });

const textWithLinkCompositionSchema: z.ZodType<TextWithLinkComposition> = z.array(
  z.discriminatedUnion('nodeType', [
    z.object({
      nodeType: z.literal('DisplayText'),
      keyPath: z.string(),
    }),
    z.object({
      nodeType: z.literal('Link'),
      url: z.string(),
      textToDisplay: z.object({
        keyPath: z.string(),
        nodeType: z.literal('DisplayText'),
      }),
      testId: z.string().optional(),
    }),
  ])
);

const legalConfigSchema = z.record(z.string(), textWithLinkCompositionSchema);

export const LEGAL_CONFIG = legalConfigSchema.parse(mergedLegalConfig);

export const getLegalCompositionForLocation = (locationKey: string): TextWithLinkComposition | undefined => {
  const legalComposition = LEGAL_CONFIG[locationKey];
  if (legalComposition.length === 0) {
    return undefined;
  }
  return legalComposition;
};
