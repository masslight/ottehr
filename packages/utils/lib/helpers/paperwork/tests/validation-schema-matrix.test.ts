import { QuestionnaireResponseItem } from 'fhir/r4b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntakeQuestionnaireItem } from '../../../types/data/paperwork/paperwork.types';
import { makeValidationSchema } from '../validation';

/**
 * Accept/reject matrix for makeValidationSchema, the yup schema factory shared by the
 * intake frontend (per-page resolver), the submit-paperwork zambda (whole-questionnaire
 * gate), and the EHR patient-account update. One row per item type × dataType behavior,
 * so the validation contract of every certified part is pinned explicitly instead of
 * implied by whichever real pages happen to use it.
 */

const PAGE = 'matrix-page';

const item = (
  overrides: Partial<IntakeQuestionnaireItem> & Pick<IntakeQuestionnaireItem, 'linkId' | 'type'>
): IntakeQuestionnaireItem => ({
  acceptsMultipleAnswers: false,
  alwaysFilter: false,
  ...overrides,
});

const pageWith = (...items: IntakeQuestionnaireItem[]): IntakeQuestionnaireItem[] => [
  item({ linkId: PAGE, type: 'group', item: items }),
];

type PageValues = { [linkId: string]: QuestionnaireResponseItem };

const validatePage = (items: IntakeQuestionnaireItem[], values: PageValues): Promise<unknown> =>
  makeValidationSchema(pageWith(...items), PAGE).validate(values, { abortEarly: false });

const answered = (linkId: string, answer: QuestionnaireResponseItem['answer']): PageValues => ({
  [linkId]: { linkId, answer },
});

describe('string / text / open-choice items', () => {
  const requiredString = item({ linkId: 'freetext', type: 'string', required: true });

  it('accepts an ordinary string and rejects a missing required one', async () => {
    await expect(
      validatePage([requiredString], answered('freetext', [{ valueString: 'hello' }]))
    ).resolves.toBeDefined();
    await expect(validatePage([requiredString], {})).rejects.toBeDefined();
    await expect(validatePage([requiredString], { freetext: { linkId: 'freetext' } })).rejects.toBeDefined();
  });

  it('rejects emoji anywhere in the value', async () => {
    await expect(
      validatePage([requiredString], answered('freetext', [{ valueString: 'feeling great 😀' }]))
    ).rejects.toThrow(/Emojis are not a valid character/);
  });

  it('an optional string accepts being absent entirely', async () => {
    const optionalString = item({ linkId: 'freetext', type: 'string' });
    await expect(validatePage([optionalString], {})).resolves.toBeDefined();
  });
});

describe('dataType regex validation on string items', () => {
  const phone = item({ linkId: 'contact-phone', type: 'string', required: true, dataType: 'Phone Number' });
  const email = item({ linkId: 'contact-email', type: 'string', required: true, dataType: 'Email' });
  const zip = item({ linkId: 'home-zip', type: 'string', required: true, dataType: 'ZIP' });
  const ssn = item({ linkId: 'patient-ssn-field', type: 'string', required: true, dataType: 'SSN' });

  it('Phone Number requires the formatted (xxx) xxx-xxxx shape', async () => {
    await expect(
      validatePage([phone], answered('contact-phone', [{ valueString: '(555) 123-4567' }]))
    ).resolves.toBeDefined();
    await expect(validatePage([phone], answered('contact-phone', [{ valueString: '5551234567' }]))).rejects.toThrow(
      /Phone number must be 10 digits/
    );
  });

  it('Email requires a plausible address', async () => {
    await expect(
      validatePage([email], answered('contact-email', [{ valueString: 'pat@example.com' }]))
    ).resolves.toBeDefined();
    await expect(validatePage([email], answered('contact-email', [{ valueString: 'not-an-email' }]))).rejects.toThrow(
      /Email is not valid/
    );
  });

  it('ZIP accepts 5 or 9 digits and rejects anything else', async () => {
    await expect(validatePage([zip], answered('home-zip', [{ valueString: '12345' }]))).resolves.toBeDefined();
    await expect(validatePage([zip], answered('home-zip', [{ valueString: '12345-6789' }]))).resolves.toBeDefined();
    await expect(validatePage([zip], answered('home-zip', [{ valueString: '1234' }]))).rejects.toThrow(
      /ZIP Code must be 5 or 9 numbers/
    );
  });

  it('SSN requires xxx-xx-xxxx and rejects the reserved 000 prefix', async () => {
    await expect(
      validatePage([ssn], answered('patient-ssn-field', [{ valueString: '123-45-6789' }]))
    ).resolves.toBeDefined();
    await expect(validatePage([ssn], answered('patient-ssn-field', [{ valueString: '123456789' }]))).rejects.toThrow(
      /SSN must be in the format/
    );
    await expect(validatePage([ssn], answered('patient-ssn-field', [{ valueString: '000-45-6789' }]))).rejects.toThrow(
      /SSN must be in the format/
    );
  });
});

describe('boolean items', () => {
  it('a required boolean rejects a missing answer and accepts either value', async () => {
    const consent = item({ linkId: 'agree', type: 'boolean', required: true });
    await expect(validatePage([consent], answered('agree', [{ valueBoolean: false }]))).resolves.toBeDefined();
    await expect(validatePage([consent], {})).rejects.toBeDefined();
  });

  it('requiredBooleanValue pins the value itself (the consent-checkbox pattern)', async () => {
    const mustBeTrue = item({ linkId: 'agree', type: 'boolean', required: true, requiredBooleanValue: true });
    await expect(validatePage([mustBeTrue], answered('agree', [{ valueBoolean: true }]))).resolves.toBeDefined();
    await expect(validatePage([mustBeTrue], answered('agree', [{ valueBoolean: false }]))).rejects.toBeDefined();
  });
});

describe('choice items', () => {
  const payment = item({
    linkId: 'payment-choice',
    type: 'choice',
    required: true,
    answerOption: [{ valueString: 'I have insurance' }, { valueString: 'I will pay without insurance' }],
  });

  it('accepts a listed option and rejects anything off-list', async () => {
    await expect(
      validatePage([payment], answered('payment-choice', [{ valueString: 'I have insurance' }]))
    ).resolves.toBeDefined();
    await expect(
      validatePage([payment], answered('payment-choice', [{ valueString: 'store credit' }]))
    ).rejects.toThrow(/must be one of the provided answer options/);
  });

  it('rejects a missing required choice', async () => {
    await expect(validatePage([payment], {})).rejects.toBeDefined();
  });
});

describe('dynamic answer options', () => {
  it('a value-set-backed choice accepts any string (options resolve at runtime)', async () => {
    const dynamicChoice = item({
      linkId: 'insurance-carrier',
      type: 'choice',
      required: true,
      answerLoadingOptions: { strategy: 'prefetch' },
    });
    await expect(
      validatePage([dynamicChoice], answered('insurance-carrier', [{ valueString: 'Any Carrier Name' }]))
    ).resolves.toBeDefined();
  });

  it('a reference-backed choice requires reference and display', async () => {
    const referenceChoice = item({
      linkId: 'preferred-pharmacy',
      type: 'choice',
      required: true,
      answerLoadingOptions: {
        strategy: 'dynamic',
        answerSource: { zambdaId: 'get-answer-options', resourceType: 'Organization', query: 'type=pharmacy' },
      },
    });
    await expect(
      validatePage(
        [referenceChoice],
        answered('preferred-pharmacy', [
          { valueReference: { reference: 'Organization/abc', display: 'Corner Pharmacy' } },
        ])
      )
    ).resolves.toBeDefined();
    await expect(
      validatePage(
        [referenceChoice],
        answered('preferred-pharmacy', [{ valueReference: { reference: 'Organization/abc' } }])
      )
    ).rejects.toBeDefined();
  });
});

describe('date items', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dob = item({ linkId: 'birthdate', type: 'date', required: true, dataType: 'DOB' });

  it('DOB accepts a past ISO date and rejects malformed or out-of-range strings', async () => {
    await expect(validatePage([dob], answered('birthdate', [{ valueString: '1990-05-01' }]))).resolves.toBeDefined();
    await expect(validatePage([dob], answered('birthdate', [{ valueString: 'May 1 1990' }]))).rejects.toBeDefined();
    await expect(validatePage([dob], answered('birthdate', [{ valueString: '2020-13-01' }]))).rejects.toBeDefined();
  });

  it('DOB rejects a future date', async () => {
    await expect(validatePage([dob], answered('birthdate', [{ valueString: '2030-01-01' }]))).rejects.toThrow(
      /Date may not be in the future/
    );
  });

  it('validateAgeOver enforces the age floor', async () => {
    const adultDob = item({ ...dob, validateAgeOver: 18 });
    await expect(
      validatePage([adultDob], answered('birthdate', [{ valueString: '2000-01-01' }]))
    ).resolves.toBeDefined();
    await expect(validatePage([adultDob], answered('birthdate', [{ valueString: '2010-01-01' }]))).rejects.toThrow(
      /Must be 18 years or older/
    );
  });

  it('a non-DOB date allows the future (the appointment-date pattern)', async () => {
    const plainDate = item({ linkId: 'follow-up-date', type: 'date', required: true });
    await expect(
      validatePage([plainDate], answered('follow-up-date', [{ valueString: '2030-01-01' }]))
    ).resolves.toBeDefined();
  });
});

describe('attachment items', () => {
  const photoId = item({ linkId: 'photo-id-front-field', type: 'attachment', required: true, dataType: 'Image' });
  const fullAttachment = {
    valueAttachment: { url: 'z3://bucket/photo.jpg', contentType: 'image/jpeg', title: 'photo.jpg' },
  };

  it('a required attachment needs url, contentType, and title', async () => {
    await expect(validatePage([photoId], answered('photo-id-front-field', [fullAttachment]))).resolves.toBeDefined();
    await expect(
      validatePage(
        [photoId],
        answered('photo-id-front-field', [
          { valueAttachment: { url: 'z3://bucket/photo.jpg', contentType: 'image/jpeg' } },
        ])
      )
    ).rejects.toBeDefined();
    await expect(validatePage([photoId], {})).rejects.toBeDefined();
  });

  it('an optional attachment may be absent, but a partial upload still rejects', async () => {
    const optionalPhoto = item({ ...photoId, required: false });
    await expect(validatePage([optionalPhoto], {})).resolves.toBeDefined();
    await expect(
      validatePage(
        [optionalPhoto],
        answered('photo-id-front-field', [{ valueAttachment: { url: 'z3://bucket/photo.jpg' } }])
      )
    ).rejects.toBeDefined();
  });
});

describe('decimal items', () => {
  const weight = item({ linkId: 'patient-weight', type: 'decimal', required: true });

  it('accepts a number and rejects a non-numeric value', async () => {
    await expect(validatePage([weight], answered('patient-weight', [{ valueDecimal: 68.5 }]))).resolves.toBeDefined();
    await expect(
      validatePage([weight], answered('patient-weight', [{ valueDecimal: 'heavy' as unknown as number }]))
    ).rejects.toBeDefined();
  });

  it('treats an empty string as missing, so required still rejects it', async () => {
    await expect(
      validatePage([weight], answered('patient-weight', [{ valueDecimal: '' as unknown as number }]))
    ).rejects.toBeDefined();
  });
});

describe('answer cardinality', () => {
  it('a single-answer item rejects multiple answers', async () => {
    const single = item({ linkId: 'nickname', type: 'string' });
    await expect(
      validatePage([single], answered('nickname', [{ valueString: 'Pat' }, { valueString: 'Patty' }]))
    ).rejects.toBeDefined();
  });

  it('acceptsMultipleAnswers admits several answers and required still needs at least one', async () => {
    const multi = item({
      linkId: 'languages',
      type: 'choice',
      required: true,
      acceptsMultipleAnswers: true,
      answerOption: [{ valueString: 'English' }, { valueString: 'Spanish' }, { valueString: 'French' }],
    });
    await expect(
      validatePage([multi], answered('languages', [{ valueString: 'English' }, { valueString: 'French' }]))
    ).resolves.toBeDefined();
    await expect(validatePage([multi], {})).rejects.toBeDefined();
  });
});

describe('schema relaxations', () => {
  it('a required field whose filterWhen holds is exempt from validation', async () => {
    const gate = item({ linkId: 'manual-entry', type: 'boolean' });
    const searchState = item({
      linkId: 'search-state',
      type: 'string',
      required: true,
      filterWhen: [{ question: 'manual-entry', operator: '=', answerBoolean: true }],
    });
    const filteredValues: PageValues = {
      'manual-entry': { linkId: 'manual-entry', answer: [{ valueBoolean: true }] },
    };
    const unfilteredValues: PageValues = {
      'manual-entry': { linkId: 'manual-entry', answer: [{ valueBoolean: false }] },
    };
    await expect(validatePage([gate, searchState], filteredValues)).resolves.toBeDefined();
    await expect(validatePage([gate, searchState], unfilteredValues)).rejects.toBeDefined();
  });

  it('display and readOnly items are excluded from the schema entirely', async () => {
    const caption = item({ linkId: 'page-caption', type: 'display', required: true });
    const logical = item({ linkId: 'hidden-logical', type: 'string', required: true, readOnly: true });
    await expect(validatePage([caption, logical], {})).resolves.toBeDefined();
  });
});

describe('group items', () => {
  it('validates required members inside a nested group', async () => {
    const group = item({
      linkId: 'insurance-group',
      type: 'group',
      item: [item({ linkId: 'member-id', type: 'string', required: true })],
    });
    const filled: PageValues = {
      'insurance-group': {
        linkId: 'insurance-group',
        item: [{ linkId: 'member-id', answer: [{ valueString: 'ABC123' }] }],
      },
    };
    const blank: PageValues = {
      'insurance-group': { linkId: 'insurance-group', item: [{ linkId: 'member-id' }] },
    };
    await expect(validatePage([group], filled)).resolves.toBeDefined();
    await expect(validatePage([group], blank)).rejects.toBeDefined();
  });
});

describe('unsupported item types', () => {
  // schemaForItem throws for item types it has no schema for — synchronously, while the
  // lazy schema is being built. A config that sneaks an unsupported type past generation
  // fails validation loudly, not silently.
  it('validating a page containing an unsupported type throws "no schema defined"', () => {
    const unsupported = item({ linkId: 'quantity-field', type: 'integer' });
    expect(() => validatePage([unsupported], {})).toThrow(/no schema defined/);
  });
});
