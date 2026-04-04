import Oystehr from '@oystehr/sdk';
import { Extension, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { rcmMeta } from '../../shared';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;

export const INVOICING_CONFIG_QUESTIONNAIRE_URL = 'urn:uuid:questionnaire:invoicing-config';
export const AVAILABLE_TOKENS_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/available-tokens`;

const DEFAULT_SMS_TEMPLATE =
  "Thank you, {{patient-full-name}}, for visiting {{clinic}} at {{location}} on {{visit-date}}! You have a balance due of {{amount}}.\n\n💳 If we have your card on file, it will be billed on {{due-date}}, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before due date: {{invoice-link}}";

const DEFAULT_MEMO_TEMPLATE =
  "Thank you, {{patient-full-name}}, for visiting {{clinic}} at {{location}} on {{visit-date}}! You have a balance due of {{amount}}.\n\n💳 If we have your card on file, it will be billed on {{due-date}}, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before the due date. For more details about the visit, please, visit your patient portal, {{patient-portal-link}}";

const TOKENS = [
  '{{patient-full-name}}',
  '{{clinic}}',
  '{{location}}',
  '{{visit-date}}',
  '{{due-date}}',
  '{{amount}}',
  '{{invoice-link}}',
  '{{patient-portal-link}}',
];

function buildTokenExtension(tokens: string[]): Extension[] {
  return [
    {
      url: AVAILABLE_TOKENS_EXTENSION_URL,
      extension: tokens.map((token) => ({
        url: 'token',
        valueString: token,
      })),
    },
  ];
}

function buildDefaultQuestionnaire(): Questionnaire {
  return {
    resourceType: 'Questionnaire',
    url: INVOICING_CONFIG_QUESTIONNAIRE_URL,
    version: '1.0.0',
    name: 'InvoicingConfig',
    title: 'Invoicing Feature Configuration',
    status: 'active',
    subjectType: ['Organization'],
    description:
      'Defines the configurable settings for the invoicing feature, including message templates and billing behavior.',
    meta: rcmMeta('invoice-config'),
    item: [
      {
        linkId: 'invoicing',
        text: 'Invoicing Settings',
        type: 'group',
        item: [
          {
            linkId: 'invoicing.dueDaysFromGeneration',
            text: 'Days until invoice due (from generation date)',
            type: 'integer',
            required: true,
            initial: [{ valueInteger: 7 }],
            extension: [
              {
                url: 'http://hl7.org/fhir/StructureDefinition/minValue',
                valueInteger: 1,
              },
              {
                url: 'http://hl7.org/fhir/StructureDefinition/maxValue',
                valueInteger: 365,
              },
            ],
          },
          {
            linkId: 'invoicing.defaultSmsTemplate',
            text: 'Default SMS message template',
            type: 'text',
            required: true,
            initial: [{ valueString: DEFAULT_SMS_TEMPLATE }],
            extension: buildTokenExtension(TOKENS),
          },
          {
            linkId: 'invoicing.defaultInvoiceMemo',
            text: 'Default invoice memo template',
            type: 'text',
            required: true,
            initial: [{ valueString: DEFAULT_MEMO_TEMPLATE }],
            extension: buildTokenExtension(TOKENS),
          },
        ],
      },
    ],
  };
}

function buildDefaultQuestionnaireResponse(questionnaireId: string): Omit<QuestionnaireResponse, 'id'> {
  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: `Questionnaire/${questionnaireId}`,
    status: 'completed',
    meta: rcmMeta('invoice-config'),
    item: [
      {
        linkId: 'invoicing',
        text: 'Invoicing Settings',
        item: [
          {
            linkId: 'invoicing.dueDaysFromGeneration',
            text: 'Days until invoice due (from generation date)',
            answer: [{ valueInteger: 7 }],
          },
          {
            linkId: 'invoicing.defaultSmsTemplate',
            text: 'Default SMS message template',
            answer: [{ valueString: DEFAULT_SMS_TEMPLATE }],
          },
          {
            linkId: 'invoicing.defaultInvoiceMemo',
            text: 'Default invoice memo template',
            answer: [{ valueString: DEFAULT_MEMO_TEMPLATE }],
          },
        ],
      },
    ],
  };
}

export interface InvoicingConfigPair {
  questionnaire: Questionnaire;
  questionnaireResponse: QuestionnaireResponse;
}

export interface ParsedInvoicingConfig {
  dueDaysFromGeneration: number;
  defaultSmsTemplate: string;
  defaultInvoiceMemo: string;
}

export function parseInvoicingConfig(qr: QuestionnaireResponse): ParsedInvoicingConfig {
  const group = qr.item?.find((i) => i.linkId === 'invoicing');
  const items = group?.item ?? [];
  const findAnswer = (
    linkId: string
  ): { valueInteger?: number; valueBoolean?: boolean; valueString?: string } | undefined =>
    items.find((i) => i.linkId === linkId)?.answer?.[0];
  return {
    dueDaysFromGeneration: findAnswer('invoicing.dueDaysFromGeneration')?.valueInteger ?? 7,
    defaultSmsTemplate: findAnswer('invoicing.defaultSmsTemplate')?.valueString ?? DEFAULT_SMS_TEMPLATE,
    defaultInvoiceMemo: findAnswer('invoicing.defaultInvoiceMemo')?.valueString ?? DEFAULT_MEMO_TEMPLATE,
  };
}

/**
 * Finds the existing invoicing config Questionnaire + QuestionnaireResponse pair.
 * If either doesn't exist, creates them with defaults.
 */
export async function getOrCreateInvoicingConfig(oystehr: Oystehr): Promise<InvoicingConfigPair> {
  // Search for existing Questionnaire tagged as rcm + invoice-config
  const questionnaireBundle = await oystehr.fhir.search<Questionnaire>({
    resourceType: 'Questionnaire',
    params: [
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|invoice-config` },
      { name: 'url', value: INVOICING_CONFIG_QUESTIONNAIRE_URL },
    ],
  });
  const questionnaires = questionnaireBundle.unbundle();

  let questionnaire: Questionnaire;

  if (questionnaires.length > 0) {
    questionnaire = questionnaires[0];
  } else {
    console.log('No invoicing config Questionnaire found, creating one with defaults');
    questionnaire = await oystehr.fhir.create<Questionnaire>(buildDefaultQuestionnaire());
  }

  // Search for existing QuestionnaireResponse
  const responseBundle = await oystehr.fhir.search<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    params: [
      { name: '_tag', value: `${RCM_TAG_SYSTEM}|invoice-config` },
      { name: 'questionnaire', value: `Questionnaire/${questionnaire.id}` },
    ],
  });
  const responses = responseBundle.unbundle();

  let questionnaireResponse: QuestionnaireResponse;

  if (responses.length > 0) {
    questionnaireResponse = responses[0];
  } else {
    console.log('No invoicing config QuestionnaireResponse found, creating one with defaults');
    questionnaireResponse = await oystehr.fhir.create<QuestionnaireResponse>(
      buildDefaultQuestionnaireResponse(questionnaire.id!)
    );
  }

  return { questionnaire, questionnaireResponse };
}
