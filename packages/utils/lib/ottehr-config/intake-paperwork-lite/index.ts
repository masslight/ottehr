// Lite intake paperwork — a stripped-down pre-visit flow that includes only:
//   1. A brief welcome page (single display item) — this page exists ONLY so the
//      paperwork renderer's practice-managed-Q injection logic has a non-consent
//      page to land on; the renderer triggers the injection check when the NEXT
//      page is a finalization page (consent / medical-history), so a Questionnaire
//      with consent as the first/only page would never trigger the check.
//   2. The standard consent-forms page (same `consent-forms-page` linkId as the
//      full intake flows, so the existing consent harvest + UI logic apply
//      verbatim — including the `pageHarvestStrategy['consent-forms-page']` map).
//
// When a practice tags a practice-managed Questionnaire for this flow (via the
// "Present with" admin picker), it's injected between the welcome page and the
// consent page so the patient sees:  Welcome → Practice-managed Q(s) → Consent.
//
// Used when the practice schedules an appointment with paperwork subtype
// 'consent-form-only'. The appointment scaffolds its QuestionnaireResponse against
// LITE_INTAKE_PAPERWORK_CANONICAL instead of the full in-person/virtual canonical.

import {
  type PaperworkConfig,
  PaperworkConfigSchema,
  PaperworkFormFields,
  type QuestionnaireBase,
  type QuestionnaireConfigType,
  type ResolvedConsentFormConfig,
  type ValueSetsConfig,
} from 'config-types';
import { Questionnaire } from 'fhir/r4b';
import { mergeAndFreezeConfigObjects } from '../../config-helpers/helpers';
import { buildConsentFormCheckboxItems } from '../../config-helpers/intake-paperwork';
import { createQuestionnaireFromConfig } from '../../config-helpers/shared-questionnaire';
import { getConsentFormsForLocation } from '../consent-forms';
import { VALUE_SETS } from '../value-sets';

export const LITE_INTAKE_PAPERWORK_URL = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-consent-only';
export const LITE_INTAKE_PAPERWORK_VERSION = '1.0.0';
export const LITE_INTAKE_PAPERWORK_CANONICAL = {
  url: LITE_INTAKE_PAPERWORK_URL,
  version: LITE_INTAKE_PAPERWORK_VERSION,
} as const;

const hiddenFormSections: string[] = [];

const questionnaireBaseDefaults = {
  resourceType: 'Questionnaire',
  url: LITE_INTAKE_PAPERWORK_URL,
  version: LITE_INTAKE_PAPERWORK_VERSION,
  name: 'intake-paperwork-consent-only',
  title: 'Consent form only',
  status: 'active',
} as const satisfies QuestionnaireBase;

// FormFields builder takes valueSets the same way the full intake configs do, even
// though this minimal flow doesn't use them — keeps the shape uniform so anything
// that switches on PaperworkConfig.FormFields treats this flow the same way.
function buildFormFields(_valueSets: ValueSetsConfig): PaperworkFormFields {
  return {
    welcome: {
      linkId: 'provider-questionnaire-intro-page',
      title: 'Provider questionnaire',
      items: {
        intro: {
          key: 'provider-questionnaire-intro',
          text: 'Your provider has asked you to complete a short questionnaire. Click Continue to begin.',
          type: 'display',
        },
      },
      hiddenFields: [],
      requiredFields: [],
    },
    consentForms: {
      linkId: 'consent-forms-page',
      title: 'Complete consent forms',
      reviewText: 'Consent forms',
      triggers: [
        {
          targetQuestionLinkId: '$status',
          effect: ['enable'],
          operator: '!=',
          answerString: 'completed',
        },
        {
          targetQuestionLinkId: '$status',
          effect: ['enable'],
          operator: '!=',
          answerString: 'amended',
        },
      ],
      enableBehavior: 'all',
      items: {
        checkboxGroup: {
          key: 'consent-forms-checkbox-group',
          type: 'group',
          // items + requiredFields populated dynamically below from the resolved
          // consent-forms config (same as full intake flows).
          items: {},
          requiredFields: [],
        },
        signature: {
          key: 'signature',
          label: 'Signature',
          type: 'string',
          dataType: 'Signature',
          triggers: [
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'completed',
            },
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'amended',
            },
          ],
          enableBehavior: 'all',
          disabledDisplay: 'disabled',
        },
        fullName: {
          key: 'full-name',
          label: 'Full name',
          type: 'string',
          triggers: [
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'completed',
            },
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'amended',
            },
          ],
          enableBehavior: 'all',
          autocomplete: 'section-consent-forms shipping name',
          disabledDisplay: 'disabled',
        },
        consentFormSignerRelationship: {
          key: 'consent-form-signer-relationship',
          label: 'Relationship to the patient',
          type: 'choice',
          options: VALUE_SETS.relationshipOptions,
          triggers: [
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'completed',
            },
            {
              targetQuestionLinkId: '$status',
              effect: ['enable'],
              operator: '!=',
              answerString: 'amended',
            },
          ],
          enableBehavior: 'all',
          disabledDisplay: 'disabled',
        },
      },
      hiddenFields: [],
      requiredFields: ['signature', 'full-name', 'consent-form-signer-relationship'],
    },
  };
}

export function getLiteIntakePaperworkConfig(consentFormsConfig?: ResolvedConsentFormConfig[]): PaperworkConfig {
  const valueSets = VALUE_SETS;
  const consentForms = consentFormsConfig ?? getConsentFormsForLocation();
  const FormFields = buildFormFields(valueSets);

  const DEFAULTS: PaperworkConfig = {
    questionnaireBase: questionnaireBaseDefaults,
    hiddenFormSections,
    FormFields,
  };

  // Inject the resolved consent-forms list (same merge pattern the full intake
  // configs use) so the checkbox group reflects whatever consent forms are
  // configured for the current location.
  const consentFormsOverride = {
    FormFields: {
      consentForms: {
        items: {
          checkboxGroup: {
            items: buildConsentFormCheckboxItems(consentForms),
            requiredFields: consentForms.map((f) => f.id),
          },
        },
      },
    },
  };

  const merged = mergeAndFreezeConfigObjects(DEFAULTS, consentFormsOverride);
  return PaperworkConfigSchema.parse(merged);
}

export const LITE_INTAKE_PAPERWORK_CONFIG = getLiteIntakePaperworkConfig();

export const LITE_INTAKE_PAPERWORK_QUESTIONNAIRE = (): Questionnaire =>
  JSON.parse(JSON.stringify(createQuestionnaireFromConfig(LITE_INTAKE_PAPERWORK_CONFIG as QuestionnaireConfigType)));
