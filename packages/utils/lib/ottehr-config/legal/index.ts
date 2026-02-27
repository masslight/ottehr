import {
  type LegalConfig,
  LegalConfigSchema,
  type LinkDef,
  LinkDefSchema,
  type TextWithLinkComposition,
} from 'config-types';
import { LEGAL_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const LEGAL_DEFAULTS = {
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
      tags: ['privacy-policy'],
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
      tags: ['terms-and-conditions'],
    },
  ],
  PAPERWORK_REVIEW_PAGE: [
    {
      literal: 'By proceeding with a visit, you acknowledge that you have reviewed and accept our ',
      nodeType: 'DisplayText',
    },
    {
      url: '/template.pdf',
      textToDisplay: { literal: 'Privacy Policy', nodeType: 'DisplayText' },
      testId: 'privacy-policy-review-screen',
      nodeType: 'Link',
      tags: ['privacy-policy'],
    },
    { literal: ' and ', nodeType: 'DisplayText' },
    {
      url: '/template.pdf',
      textToDisplay: { keyPath: 'reviewAndSubmit.termsAndConditions', nodeType: 'DisplayText' },
      testId: 'terms-conditions-review-screen',
      nodeType: 'Link',
      tags: ['terms-and-conditions'],
    },
  ],
} as const satisfies LegalConfig;

const mergedLegalConfig = mergeAndFreezeConfigObjects(LEGAL_DEFAULTS, OVERRIDES);

export const LEGAL_CONFIG = LegalConfigSchema.parse(mergedLegalConfig);

export const getLegalCompositionForLocation = (locationKey: string): TextWithLinkComposition | undefined => {
  const legalComposition = LEGAL_CONFIG[locationKey];
  if (!legalComposition || legalComposition.length === 0) {
    return undefined;
  }
  return legalComposition;
};

export const getPrivacyPolicyLinkDefForLocation = (locationKey: string): LinkDef | undefined => {
  const legalComposition = getLegalCompositionForLocation(locationKey);
  if (!legalComposition) {
    return undefined;
  }
  return LinkDefSchema.safeParse(
    legalComposition.find(
      (node) => node.nodeType === 'Link' && 'tags' in node && node.tags?.includes('privacy-policy')
    ) ?? {}
  )?.data;
};

export const getTermsAndConditionsLinkDefForLocation = (locationKey: string): LinkDef | undefined => {
  const legalComposition = getLegalCompositionForLocation(locationKey);
  if (!legalComposition) {
    return undefined;
  }
  return LinkDefSchema.safeParse(
    legalComposition.find(
      (node) => node.nodeType === 'Link' && 'tags' in node && node.tags?.includes('terms-and-conditions')
    ) ?? {}
  )?.data;
};
