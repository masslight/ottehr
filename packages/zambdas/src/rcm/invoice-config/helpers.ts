import Oystehr from '@oystehr/sdk';
import { Extension, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import {
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_INVOICE_MEMO_TEMPLATE,
  DEFAULT_INVOICE_SMS_TEMPLATE,
  ParsedInvoiceConfig,
  parseInvoiceConfigFromQR,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { rcmMeta } from '../../shared';

const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;

export const INVOICING_CONFIG_QUESTIONNAIRE_URL = 'urn:uuid:questionnaire:invoicing-config';
export const AVAILABLE_TOKENS_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/available-tokens`;

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
            initial: [{ valueInteger: DEFAULT_INVOICE_DUE_DAYS }],
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
            initial: [{ valueString: DEFAULT_INVOICE_SMS_TEMPLATE }],
            extension: buildTokenExtension(TOKENS),
          },
          {
            linkId: 'invoicing.defaultInvoiceMemo',
            text: 'Default invoice memo template',
            type: 'text',
            required: true,
            initial: [{ valueString: DEFAULT_INVOICE_MEMO_TEMPLATE }],
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
            answer: [{ valueInteger: DEFAULT_INVOICE_DUE_DAYS }],
          },
          {
            linkId: 'invoicing.defaultSmsTemplate',
            text: 'Default SMS message template',
            answer: [{ valueString: DEFAULT_INVOICE_SMS_TEMPLATE }],
          },
          {
            linkId: 'invoicing.defaultInvoiceMemo',
            text: 'Default invoice memo template',
            answer: [{ valueString: DEFAULT_INVOICE_MEMO_TEMPLATE }],
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

export type ParsedInvoicingConfig = ParsedInvoiceConfig;

export function parseInvoicingConfig(qr: QuestionnaireResponse): ParsedInvoicingConfig {
  return parseInvoiceConfigFromQR(qr);
}

/**
 * Finds the existing invoicing config Questionnaire + QuestionnaireResponse pair.
 * If either doesn't exist, creates them with defaults.
 * Guarantees at most one Questionnaire and one QuestionnaireResponse exist;
 * logs a warning if duplicates are detected.
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

  if (questionnaires.length > 1) {
    const ids = questionnaires.map((q) => q.id).join(', ');
    console.warn(
      `Found ${questionnaires.length} invoicing config Questionnaires (expected 1). Using the first. IDs: ${ids}`
    );
  }

  if (questionnaires.length > 0) {
    questionnaire = questionnaires[0];
  } else {
    console.log('No invoicing config Questionnaire found, creating one with defaults');
    questionnaire = await oystehr.fhir.create<Questionnaire>(buildDefaultQuestionnaire());
  }

  // Search for existing QuestionnaireResponse linked to *any* invoicing config
  // Questionnaire (search by tag, not by specific ID, so that even if the QR
  // outlives a deleted Questionnaire it is still found and re-linked).
  const responseBundle = await oystehr.fhir.search<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    params: [{ name: '_tag', value: `${RCM_TAG_SYSTEM}|invoice-config` }],
  });
  const responses = responseBundle.unbundle();

  if (responses.length > 1) {
    const ids = responses.map((r) => r.id).join(', ');
    console.warn(
      `Found ${responses.length} invoicing config QuestionnaireResponses (expected 1). Using the first. IDs: ${ids}`
    );
  }

  let questionnaireResponse: QuestionnaireResponse;

  if (responses.length > 0) {
    questionnaireResponse = responses[0];
    // Ensure the QR points at the current Questionnaire
    const expectedRef = `Questionnaire/${questionnaire.id}`;
    if (questionnaireResponse.questionnaire !== expectedRef) {
      console.log(`Re-linking QuestionnaireResponse/${questionnaireResponse.id} to ${expectedRef}`);
      questionnaireResponse = await oystehr.fhir.patch<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        id: questionnaireResponse.id!,
        operations: [
          {
            op: questionnaireResponse.questionnaire ? 'replace' : 'add',
            path: '/questionnaire',
            value: expectedRef,
          },
        ],
      });
    }
  } else {
    console.log('No invoicing config QuestionnaireResponse found, creating one with defaults');
    questionnaireResponse = await oystehr.fhir.create<QuestionnaireResponse>(
      buildDefaultQuestionnaireResponse(questionnaire.id!)
    );
  }

  return { questionnaire, questionnaireResponse };
}
