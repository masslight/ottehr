import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { getQuestionnaireItemsAndProgress } from 'utils/lib/helpers/paperwork/paperwork';
import { IntakeQuestionnaireItem } from 'utils/lib/types/data/paperwork/paperwork.types';
import { QUESTIONNAIRE_RESPONSE_INVALID_ERROR } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { validateSubmitInputs } from '../../../src/patient/paperwork/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

/**
 * Coverage for complexSubmitValidation — the whole-questionnaire gate every intake
 * submission passes through, and the only place validation failures are translated into
 * the user-facing QUESTIONNAIRE_RESPONSE_INVALID_ERROR({ page: [field labels] }) shape.
 * This error surface previously had no live tests (the legacy pre-FHIR suites that
 * covered it were describe.skip'd and are deleted in this change); these tests re-establish
 * the scenarios against the current questionnaire pipeline.
 *
 * getQuestionnaireItemsAndProgress is mocked so the suite is hermetic: the questionnaire
 * pages and the saved QuestionnaireResponse state are supplied per test, and everything
 * downstream (yup schema, enableWhen evaluation, error mapping, disabled-page filtering)
 * runs for real.
 */

vi.mock('utils/lib/helpers/paperwork/paperwork', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/helpers/paperwork/paperwork')>();
  return { ...original, getQuestionnaireItemsAndProgress: vi.fn() };
});

const mockProgress = vi.mocked(getQuestionnaireItemsAndProgress);

const QR_ID = '550e8400-e29b-41d4-a716-446655440000';

const item = (
  overrides: Partial<IntakeQuestionnaireItem> & Pick<IntakeQuestionnaireItem, 'linkId' | 'type'>
): IntakeQuestionnaireItem => ({
  acceptsMultipleAnswers: false,
  alwaysFilter: false,
  ...overrides,
});

const CONTACT_PAGE = 'contact-page';
const PAYMENT_PAGE = 'payment-page';
const WC_PAGE = 'workers-comp-page';
const CONSENT_PAGE = 'consent-page';

const QUESTIONNAIRE_PAGES: IntakeQuestionnaireItem[] = [
  item({
    linkId: CONTACT_PAGE,
    type: 'group',
    item: [
      item({ linkId: 'first-name', type: 'string', required: true, text: 'First name' }),
      item({ linkId: 'email', type: 'string', dataType: 'Email', text: 'Email' }),
      item({ linkId: 'service-category', type: 'string', readOnly: true }),
    ],
  }),
  item({
    linkId: PAYMENT_PAGE,
    type: 'group',
    item: [
      item({
        linkId: 'payment-choice',
        type: 'choice',
        required: true,
        text: 'How would you like to pay?',
        answerOption: [{ valueString: 'I have insurance' }, { valueString: 'Self-pay' }],
      }),
    ],
  }),
  item({
    linkId: WC_PAGE,
    type: 'group',
    enableWhen: [{ question: `${CONTACT_PAGE}.service-category`, operator: '=', answerString: 'workers-comp' }],
    item: [item({ linkId: 'wc-employer-name', type: 'string', required: true, text: 'Employer name' })],
  }),
  item({
    linkId: CONSENT_PAGE,
    type: 'group',
    enableBehavior: 'all',
    enableWhen: [
      { question: '$status', operator: '!=', answerString: 'completed' } as never,
      { question: '$status', operator: '!=', answerString: 'amended' } as never,
    ],
    item: [item({ linkId: 'signature', type: 'string', required: true, text: 'Signature' })],
  }),
];

interface QRStateOptions {
  firstName?: string;
  email?: string;
  category?: string;
  paymentChoice?: string;
  signature?: string;
  status?: QuestionnaireResponse['status'];
}

const answerOrBlank = (linkId: string, value?: string): QuestionnaireResponseItem => ({
  linkId,
  ...(value !== undefined ? { answer: [{ valueString: value }] } : {}),
});

const qrState = (options: QRStateOptions): QuestionnaireResponseItem[] => [
  {
    linkId: CONTACT_PAGE,
    item: [
      answerOrBlank('first-name', options.firstName),
      answerOrBlank('email', options.email),
      answerOrBlank('service-category', options.category),
    ],
  },
  { linkId: PAYMENT_PAGE, item: [answerOrBlank('payment-choice', options.paymentChoice)] },
  { linkId: WC_PAGE, item: [] },
  { linkId: CONSENT_PAGE, item: [answerOrBlank('signature', options.signature)] },
];

const primeQR = (options: QRStateOptions): QuestionnaireResponseItem[] => {
  const answers = qrState(options);
  mockProgress.mockResolvedValue({
    items: QUESTIONNAIRE_PAGES,
    fullQRResource: {
      resourceType: 'QuestionnaireResponse',
      status: options.status ?? 'in-progress',
      item: answers,
    },
  });
  return answers;
};

const submit = (answers: QuestionnaireResponseItem[]): Promise<unknown> =>
  validateSubmitInputs(createMockZambdaInput({ answers, questionnaireResponseId: QR_ID }), {} as never);

const VALID_STATE: QRStateOptions = {
  firstName: 'Pat',
  email: 'pat@example.com',
  category: 'urgent-care',
  paymentChoice: 'Self-pay',
  signature: 'Pat Example',
};

beforeEach(() => {
  mockProgress.mockReset();
});

describe('submit paperwork — happy path', () => {
  test('a complete submission resolves with the QR state and disabled pages stripped', async () => {
    const answers = primeQR(VALID_STATE);
    const result = (await submit(answers)) as {
      updatedAnswers: QuestionnaireResponseItem[];
      currentQRStatus: string;
      createReviewTaskAndPdf: boolean;
    };
    expect(result.currentQRStatus).toBe('in-progress');
    expect(result.createReviewTaskAndPdf).toBe(false);
    // The workers-comp page is disabled for an urgent-care visit: its content must be
    // stripped to a bare { linkId } so stale answers can never reach FHIR or harvest.
    expect(result.updatedAnswers.find((page) => page.linkId === WC_PAGE)).toEqual({ linkId: WC_PAGE });
    expect(result.updatedAnswers.find((page) => page.linkId === CONTACT_PAGE)?.item).toBeDefined();
  });

  test('throws when the questionnaire cannot be resolved for the QR', async () => {
    mockProgress.mockResolvedValue(undefined);
    await expect(submit([{ linkId: CONTACT_PAGE, item: [] }])).rejects.toThrow(/Questionnaire could not be found/);
  });
});

describe('submit paperwork — failure mapping to {page: [field]}', () => {
  test('a missing required field maps to its page and display text', async () => {
    const answers = primeQR({ ...VALID_STATE, firstName: undefined });
    await expect(submit(answers)).rejects.toEqual(
      QUESTIONNAIRE_RESPONSE_INVALID_ERROR({ [CONTACT_PAGE]: ['First name'] })
    );
  });

  test('an invalid email maps to the Email field', async () => {
    const answers = primeQR({ ...VALID_STATE, email: 'not-an-email' });
    await expect(submit(answers)).rejects.toEqual(QUESTIONNAIRE_RESPONSE_INVALID_ERROR({ [CONTACT_PAGE]: ['Email'] }));
  });

  test('an off-list choice answer maps to the choice field', async () => {
    const answers = primeQR({ ...VALID_STATE, paymentChoice: 'store credit' });
    await expect(submit(answers)).rejects.toEqual(
      QUESTIONNAIRE_RESPONSE_INVALID_ERROR({ [PAYMENT_PAGE]: ['How would you like to pay?'] })
    );
  });

  test('failures on multiple pages aggregate into one error map', async () => {
    const answers = primeQR({ ...VALID_STATE, firstName: undefined, paymentChoice: 'store credit' });
    await expect(submit(answers)).rejects.toEqual(
      QUESTIONNAIRE_RESPONSE_INVALID_ERROR({
        [CONTACT_PAGE]: ['First name'],
        [PAYMENT_PAGE]: ['How would you like to pay?'],
      })
    );
  });
});

describe('submit paperwork — conditional pages at the gate', () => {
  test("a disabled page's required fields do not block submission", async () => {
    // urgent-care ⇒ the workers-comp page is disabled; its required employer name is
    // absent and must not produce an error.
    const answers = primeQR(VALID_STATE);
    await expect(submit(answers)).resolves.toBeDefined();
  });

  test('the same page enforces its required fields once its trigger enables it', async () => {
    const answers = primeQR({ ...VALID_STATE, category: 'workers-comp' });
    await expect(submit(answers)).rejects.toEqual(
      QUESTIONNAIRE_RESPONSE_INVALID_ERROR({ [WC_PAGE]: ['Employer name'] })
    );
  });

  test('the $status-gated consent page is enforced in-progress and skipped once completed', async () => {
    const inProgress = primeQR({ ...VALID_STATE, signature: undefined });
    await expect(submit(inProgress)).rejects.toEqual(
      QUESTIONNAIRE_RESPONSE_INVALID_ERROR({ [CONSENT_PAGE]: ['Signature'] })
    );

    // Amend flow: the QR is already completed, so the consent page is disabled and its
    // missing signature cannot block the re-submission.
    const completed = primeQR({ ...VALID_STATE, signature: undefined, status: 'completed' });
    await expect(submit(completed)).resolves.toBeDefined();
  });
});

describe('submit paperwork — merge behavior of the submitted body', () => {
  test('answers under unknown page linkIds are dropped silently', async () => {
    const answers = primeQR(VALID_STATE);
    await expect(
      submit([...answers, { linkId: 'not-a-real-page', item: [{ linkId: 'x', answer: [{ valueString: 'y' }] }] }])
    ).resolves.toBeDefined();
  });

  // Pins current behavior: page-shaped submitted answers never replace the saved QR state
  // (the merge only splices items whose `answer` field is set, and pages carry `item`,
  // not `answer`). Validation therefore runs over what per-page patches already saved —
  // patch-paperwork is the write path, and submit is a gate over the accumulated QR.
  test('page-shaped answers in the body do not overwrite the saved QR state', async () => {
    primeQR({ ...VALID_STATE, firstName: undefined });
    const bodyWithFix = qrState({ ...VALID_STATE, firstName: 'Provided Only In Body' });
    await expect(submit(bodyWithFix)).rejects.toEqual(
      QUESTIONNAIRE_RESPONSE_INVALID_ERROR({ [CONTACT_PAGE]: ['First name'] })
    );
  });
});
