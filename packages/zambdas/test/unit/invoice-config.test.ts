import { QuestionnaireResponse } from 'fhir/r4b';
import { describe, expect, test, vi } from 'vitest';
import {
  getOrCreateInvoicingConfig,
  INVOICING_CONFIG_QUESTIONNAIRE_URL,
  parseInvoicingConfig,
} from '../../src/rcm/invoice-config/helpers';
import { validateRequestParameters } from '../../src/rcm/invoice-config/save-invoice-config/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

// ---------------------------------------------------------------------------
// parseInvoicingConfig
// ---------------------------------------------------------------------------

function makeQuestionnaireResponse(overrides?: {
  dueDays?: number;
  smsTemplate?: string;
  memoTemplate?: string;
}): QuestionnaireResponse {
  const items = [];
  if (overrides?.dueDays !== undefined) {
    items.push({
      linkId: 'invoicing.dueDaysFromGeneration',
      answer: [{ valueInteger: overrides.dueDays }],
    });
  }
  if (overrides?.smsTemplate !== undefined) {
    items.push({
      linkId: 'invoicing.defaultSmsTemplate',
      answer: [{ valueString: overrides.smsTemplate }],
    });
  }
  if (overrides?.memoTemplate !== undefined) {
    items.push({
      linkId: 'invoicing.defaultInvoiceMemo',
      answer: [{ valueString: overrides.memoTemplate }],
    });
  }
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    item: [
      {
        linkId: 'invoicing',
        item: items,
      },
    ],
  };
}

describe('parseInvoicingConfig', () => {
  test('parses a fully populated QuestionnaireResponse', () => {
    const qr = makeQuestionnaireResponse({
      dueDays: 14,
      smsTemplate: 'Hello {{patient-full-name}}',
      memoTemplate: 'Memo for {{clinic}}',
    });

    const result = parseInvoicingConfig(qr);

    expect(result.dueDaysFromGeneration).toBe(14);
    expect(result.defaultSmsTemplate).toBe('Hello {{patient-full-name}}');
    expect(result.defaultInvoiceMemo).toBe('Memo for {{clinic}}');
  });

  test('falls back to defaults when QuestionnaireResponse has no items', () => {
    const qr: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [],
    };

    const result = parseInvoicingConfig(qr);

    expect(result.dueDaysFromGeneration).toBe(7);
    expect(result.defaultSmsTemplate).toContain('{{patient-full-name}}');
    expect(result.defaultInvoiceMemo).toContain('{{patient-full-name}}');
  });

  test('falls back to defaults when invoicing group is missing', () => {
    const qr: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
    };

    const result = parseInvoicingConfig(qr);

    expect(result.dueDaysFromGeneration).toBe(7);
    expect(result.defaultSmsTemplate).toBeTruthy();
    expect(result.defaultInvoiceMemo).toBeTruthy();
  });

  test('falls back to defaults for missing individual fields', () => {
    const qr = makeQuestionnaireResponse({ dueDays: 30 });

    const result = parseInvoicingConfig(qr);

    expect(result.dueDaysFromGeneration).toBe(30);
    expect(result.defaultSmsTemplate).toContain('{{clinic}}');
    expect(result.defaultInvoiceMemo).toContain('{{patient-portal-link}}');
  });
});

// ---------------------------------------------------------------------------
// validateRequestParameters (save-invoice-config)
// ---------------------------------------------------------------------------

function makeZambdaInput(body: Record<string, unknown>): ZambdaInput {
  return {
    body: JSON.stringify(body),
    secrets: { SECRET_KEY: 'test-value' },
    headers: null,
    requestContext: null,
    callerAccessToken: null,
  } as unknown as ZambdaInput;
}

describe('validateRequestParameters (save-invoice-config)', () => {
  const validBody = {
    dueDaysFromGeneration: 14,
    defaultSmsTemplate: 'Hello {{patient-full-name}}',
    defaultInvoiceMemo: 'Memo for visit',
  };

  test('accepts valid input', () => {
    const result = validateRequestParameters(makeZambdaInput(validBody));

    expect(result.dueDaysFromGeneration).toBe(14);
    expect(result.defaultSmsTemplate).toBe('Hello {{patient-full-name}}');
    expect(result.defaultInvoiceMemo).toBe('Memo for visit');
    expect(result.secrets).toBeDefined();
  });

  test('throws when body is missing', () => {
    const input = { secrets: { KEY: 'val' } } as unknown as ZambdaInput;
    expect(() => validateRequestParameters(input)).toThrow('Request body is missing');
  });

  test('throws when secrets are missing', () => {
    const input = { body: JSON.stringify(validBody), secrets: null } as unknown as ZambdaInput;
    expect(() => validateRequestParameters(input)).toThrow('Secrets are not defined');
  });

  test('throws when dueDaysFromGeneration is less than 1', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ ...validBody, dueDaysFromGeneration: 0 }))).toThrow(
      'dueDaysFromGeneration must be an integer between 1 and 365'
    );
  });

  test('throws when dueDaysFromGeneration is greater than 365', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ ...validBody, dueDaysFromGeneration: 400 }))).toThrow(
      'dueDaysFromGeneration must be an integer between 1 and 365'
    );
  });

  test('throws when dueDaysFromGeneration is not a number', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ ...validBody, dueDaysFromGeneration: 'abc' }))).toThrow(
      'dueDaysFromGeneration must be an integer between 1 and 365'
    );
  });

  test('throws when defaultSmsTemplate is empty', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ ...validBody, defaultSmsTemplate: '   ' }))).toThrow(
      'defaultSmsTemplate must be a non-empty string'
    );
  });

  test('throws when defaultSmsTemplate is not a string', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ ...validBody, defaultSmsTemplate: 123 }))).toThrow(
      'defaultSmsTemplate must be a non-empty string'
    );
  });

  test('throws when defaultInvoiceMemo is empty', () => {
    expect(() => validateRequestParameters(makeZambdaInput({ ...validBody, defaultInvoiceMemo: '' }))).toThrow(
      'defaultInvoiceMemo must be a non-empty string'
    );
  });

  test('accepts boundary value dueDaysFromGeneration = 1', () => {
    const result = validateRequestParameters(makeZambdaInput({ ...validBody, dueDaysFromGeneration: 1 }));
    expect(result.dueDaysFromGeneration).toBe(1);
  });

  test('accepts boundary value dueDaysFromGeneration = 365', () => {
    const result = validateRequestParameters(makeZambdaInput({ ...validBody, dueDaysFromGeneration: 365 }));
    expect(result.dueDaysFromGeneration).toBe(365);
  });
});

// ---------------------------------------------------------------------------
// getOrCreateInvoicingConfig
// ---------------------------------------------------------------------------

describe('getOrCreateInvoicingConfig', () => {
  function createMockOystehr(
    existingQuestionnaires: any[] = [],
    existingResponses: any[] = []
  ): { client: any; created: any[] } {
    const created: any[] = [];
    return {
      client: {
        fhir: {
          search: vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
            if (resourceType === 'Questionnaire') {
              return Promise.resolve({ unbundle: () => existingQuestionnaires });
            }
            if (resourceType === 'QuestionnaireResponse') {
              return Promise.resolve({ unbundle: () => existingResponses });
            }
            return Promise.resolve({ unbundle: () => [] });
          }),
          create: vi.fn().mockImplementation((resource: any) => {
            const withId = { ...resource, id: `created-${created.length}` };
            created.push(withId);
            return Promise.resolve(withId);
          }),
        },
      } as any,
      created,
    };
  }

  test('returns existing resources when both are found', async () => {
    const questionnaire = { resourceType: 'Questionnaire', id: 'q-1', url: INVOICING_CONFIG_QUESTIONNAIRE_URL };
    const response = { resourceType: 'QuestionnaireResponse', id: 'qr-1' };
    const { client } = createMockOystehr([questionnaire], [response]);

    const result = await getOrCreateInvoicingConfig(client);

    expect(result.questionnaire).toEqual(questionnaire);
    expect(result.questionnaireResponse).toEqual(response);
    expect(client.fhir.create).not.toHaveBeenCalled();
  });

  test('creates both resources when neither exists', async () => {
    const { client, created: _created } = createMockOystehr([], []);

    const result = await getOrCreateInvoicingConfig(client);

    expect(client.fhir.create).toHaveBeenCalledTimes(2);
    expect(result.questionnaire.id).toBe('created-0');
    expect(result.questionnaireResponse.id).toBe('created-1');
  });

  test('creates only QuestionnaireResponse when Questionnaire exists', async () => {
    const questionnaire = {
      resourceType: 'Questionnaire',
      id: 'q-existing',
      url: INVOICING_CONFIG_QUESTIONNAIRE_URL,
    };
    const { client } = createMockOystehr([questionnaire], []);

    const result = await getOrCreateInvoicingConfig(client);

    expect(client.fhir.create).toHaveBeenCalledTimes(1);
    expect(result.questionnaire.id).toBe('q-existing');
    expect(result.questionnaireResponse.id).toBe('created-0');
  });
});
