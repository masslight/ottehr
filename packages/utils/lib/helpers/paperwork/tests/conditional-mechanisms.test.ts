import { Questionnaire, QuestionnaireItem, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { IntakeQuestionnaireItem } from '../../../types/data/paperwork/paperwork.types';
import { prepareQuestionnaireResponseForHarvest } from '../../../types/data/paperwork/prepareQuestionnaireItemsForHarvest';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import {
  buildEnableWhenContext,
  evalEnableWhen,
  evalFilterWhen,
  evalItemText,
  evalRequired,
  filterDisabledPages,
  makeValidationSchema,
} from '../validation';

/**
 * Mechanism tests for the conditional-paperwork PATTERNS the instance configs are built
 * from, exercised on small synthetic questionnaires so each pattern is certified
 * independently of any real page's content. Every pattern here corresponds to a live
 * config construct:
 *
 *   - reason-for-visit page gating ......... attorney-mva-page ("Auto accident")
 *   - service-category = / != gating ....... occ-med and workers-comp page sets
 *   - compound `enableBehavior: all` ....... card-payment-page
 *   - $status gating ....................... consent-forms-page
 *   - nested gating inside a gated page .... attorney fields behind has-attorney
 *   - cross-page requireWhen ............... workers-comp SSN
 *   - textWhen substitution ................ payment-option display text
 *   - filterWhen ........................... strip-on-save fields
 *
 * The flagship assertion is the hidden-page safety conjunction: a page disabled by its
 * enableWhen must be simultaneously (a) evaluated as disabled, (b) stripped to a bare
 * { linkId } by filterDisabledPages (the submit path erases its content), and (c) skipped
 * entirely by whole-questionnaire validation, so its required fields cannot block submit.
 */

const TRIGGER_PAGE = 'trigger-page';
const CONDITIONAL_PAGE = 'conditional-page';
const REASON = 'reason-for-visit';
const CATEGORY = 'service-category';
const OCC_MED_PAYMENT = 'payment-option-occupational';

const structure = (rawPages: QuestionnaireItem[]): IntakeQuestionnaireItem[] =>
  mapQuestionnaireAndValueSetsToItemsList(rawPages, []);

const triggerPage = (children: QuestionnaireItem[] = []): QuestionnaireItem => ({
  linkId: TRIGGER_PAGE,
  type: 'group',
  item: [
    { linkId: REASON, type: 'string' },
    { linkId: CATEGORY, type: 'string' },
    { linkId: OCC_MED_PAYMENT, type: 'string' },
    ...children,
  ],
});

const triggerAnswers = (answers: Partial<Record<string, string>>): QuestionnaireResponseItem => ({
  linkId: TRIGGER_PAGE,
  item: Object.entries(answers).map(([linkId, value]) => ({
    linkId,
    ...(value !== undefined ? { answer: [{ valueString: value }] } : {}),
  })),
});

const disabledLinkIds = (result: QuestionnaireResponseItem[]): string[] =>
  result.filter((page) => !('item' in page)).map((page) => page.linkId);

describe('reason-for-visit page gating (the auto-accident pattern)', () => {
  const pages = structure([
    triggerPage(),
    {
      linkId: CONDITIONAL_PAGE,
      type: 'group',
      enableWhen: [{ question: `${TRIGGER_PAGE}.${REASON}`, operator: '=', answerString: 'Auto accident' }],
      item: [{ linkId: 'attorney-name', type: 'string' }],
    },
  ]);

  const responseFor = (reason?: string): QuestionnaireResponseItem[] => [
    triggerAnswers({ [REASON]: reason }),
    { linkId: CONDITIONAL_PAGE, item: [] },
  ];

  it('enables the page when the reason matches exactly', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('Auto accident')))).toEqual([]);
  });

  it('disables the page for any other reason', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('Fever')))).toEqual([CONDITIONAL_PAGE]);
  });

  it('disables the page while the reason is unanswered', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor(undefined)))).toEqual([CONDITIONAL_PAGE]);
  });
});

describe('service-category page gating (the occ-med / workers-comp pattern)', () => {
  const OCC_MED_ONLY_PAGE = 'occ-med-only-page';
  const NON_OCC_MED_PAGE = 'non-occ-med-page';
  const pages = structure([
    triggerPage(),
    {
      linkId: OCC_MED_ONLY_PAGE,
      type: 'group',
      enableWhen: [{ question: `${TRIGGER_PAGE}.${CATEGORY}`, operator: '=', answerString: 'occupational-medicine' }],
      item: [{ linkId: 'occ-med-field', type: 'string' }],
    },
    {
      linkId: NON_OCC_MED_PAGE,
      type: 'group',
      enableWhen: [{ question: `${TRIGGER_PAGE}.${CATEGORY}`, operator: '!=', answerString: 'occupational-medicine' }],
      item: [{ linkId: 'regular-field', type: 'string' }],
    },
  ]);

  const responseFor = (category?: string): QuestionnaireResponseItem[] => [
    triggerAnswers({ [CATEGORY]: category }),
    { linkId: OCC_MED_ONLY_PAGE, item: [] },
    { linkId: NON_OCC_MED_PAGE, item: [] },
  ];

  it('the = page and the != page are complementary for a matching category', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('occupational-medicine')))).toEqual([
      NON_OCC_MED_PAGE,
    ]);
  });

  it('any other category flips both pages', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('urgent-care')))).toEqual([OCC_MED_ONLY_PAGE]);
  });

  // An unanswered category behaves like "some other category": '=' pages hide, '!=' pages
  // show. Instances relying on the category being prepopulated get the != pages by default.
  it('an unanswered category disables = pages and enables != pages', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor(undefined)))).toEqual([OCC_MED_ONLY_PAGE]);
  });
});

describe('compound gating with enableBehavior all (the card-payment pattern)', () => {
  const pages = structure([
    triggerPage(),
    {
      linkId: CONDITIONAL_PAGE,
      type: 'group',
      enableBehavior: 'all',
      enableWhen: [
        { question: `${TRIGGER_PAGE}.${CATEGORY}`, operator: '!=', answerString: 'workers-comp' },
        { question: `${TRIGGER_PAGE}.${OCC_MED_PAYMENT}`, operator: '!=', answerString: 'Employer' },
      ],
      item: [{ linkId: 'card-field', type: 'string' }],
    },
  ]);

  const responseFor = (category?: string, occMedPayment?: string): QuestionnaireResponseItem[] => [
    triggerAnswers({ [CATEGORY]: category, [OCC_MED_PAYMENT]: occMedPayment }),
    { linkId: CONDITIONAL_PAGE, item: [] },
  ];

  // The real config depends on this exact semantic: for a non-occ-med visit the occ-med
  // payment question is never answered, and the page stays enabled only because a '!='
  // condition against a missing answer evaluates true (pinned in enable-when-matrix).
  it('is enabled when the second question is unanswered and the first passes', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('urgent-care', undefined)))).toEqual([]);
  });

  it('is disabled when either condition fails', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('workers-comp', undefined)))).toEqual([
      CONDITIONAL_PAGE,
    ]);
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('occupational-medicine', 'Employer')))).toEqual([
      CONDITIONAL_PAGE,
    ]);
  });

  it('is enabled when both conditions pass', () => {
    expect(disabledLinkIds(filterDisabledPages(pages, responseFor('occupational-medicine', 'Self')))).toEqual([]);
  });
});

describe('$status page gating (the consent-page pattern)', () => {
  const pages = structure([
    triggerPage(),
    {
      linkId: CONDITIONAL_PAGE,
      type: 'group',
      enableBehavior: 'all',
      enableWhen: [
        { question: '$status', operator: '!=', answerString: 'completed' } as never,
        { question: '$status', operator: '!=', answerString: 'amended' } as never,
      ],
      item: [{ linkId: 'signature', type: 'string', required: true }],
    },
  ]);

  const qr = (status: QuestionnaireResponse['status']): QuestionnaireResponse => ({
    resourceType: 'QuestionnaireResponse',
    status,
  });
  const consentPage = pages.find((p) => p.linkId === CONDITIONAL_PAGE);

  it('the page is enabled before first submit and disabled once completed or amended', () => {
    const values = buildEnableWhenContext([triggerAnswers({})]);
    expect(evalEnableWhen(consentPage as IntakeQuestionnaireItem, pages, values, undefined)).toBe(true);
    expect(evalEnableWhen(consentPage as IntakeQuestionnaireItem, pages, values, qr('in-progress'))).toBe(true);
    expect(evalEnableWhen(consentPage as IntakeQuestionnaireItem, pages, values, qr('completed'))).toBe(false);
    expect(evalEnableWhen(consentPage as IntakeQuestionnaireItem, pages, values, qr('amended'))).toBe(false);
  });

  // filterDisabledPages deliberately strips $status conditions before evaluating, so a
  // completed consent page is NOT normalized away — the visit-details view reads the
  // consent signer straight from the QR after completion (see the comment in
  // filterDisabledPages). Erasing it here would erase that data.
  it('filterDisabledPages ignores $status conditions and keeps the completed page content', () => {
    const response: QuestionnaireResponseItem[] = [triggerAnswers({}), { linkId: CONDITIONAL_PAGE, item: [] }];
    expect(disabledLinkIds(filterDisabledPages(pages, response, qr('completed')))).toEqual([]);
  });

  // Whole-questionnaire validation, by contrast, evaluates $status conditions for real:
  // once the QR is completed the page is skipped, so its required signature cannot block
  // a later amend-flow submission.
  it('whole-questionnaire validation enforces the page in-progress and skips it once completed', async () => {
    const submission = [triggerAnswers({}), { linkId: CONDITIONAL_PAGE, item: [] }];
    const schema = makeValidationSchema(pages, undefined);
    await expect(
      schema.validate(submission, { abortEarly: false, context: { questionnaireResponse: qr('in-progress') } })
    ).rejects.toBeDefined();
    await expect(
      schema.validate(submission, { abortEarly: false, context: { questionnaireResponse: qr('completed') } })
    ).resolves.toBeDefined();
  });
});

describe('the hidden-page safety conjunction', () => {
  // A conditional page whose only field is REQUIRED. When the page is disabled it must be
  // (a) evaluated as disabled, (b) stripped by filterDisabledPages, and (c) skipped by
  // whole-questionnaire validation so the unanswered required field cannot block submit.
  const pages = structure([
    triggerPage(),
    {
      linkId: CONDITIONAL_PAGE,
      type: 'group',
      enableWhen: [{ question: `${TRIGGER_PAGE}.${REASON}`, operator: '=', answerString: 'Auto accident' }],
      item: [{ linkId: 'attorney-name', type: 'string', required: true }],
    },
  ]);
  const conditionalPage = pages.find((p) => p.linkId === CONDITIONAL_PAGE);

  it('disabled: not enabled, stripped on save, and exempt from validation', async () => {
    const response: QuestionnaireResponseItem[] = [
      triggerAnswers({ [REASON]: 'Fever' }),
      { linkId: CONDITIONAL_PAGE, item: [] },
    ];

    const values = buildEnableWhenContext(response);
    expect(evalEnableWhen(conditionalPage as IntakeQuestionnaireItem, pages, values)).toBe(false);

    const filtered = filterDisabledPages(pages, response);
    expect(filtered.find((p) => p.linkId === CONDITIONAL_PAGE)).toEqual({ linkId: CONDITIONAL_PAGE });

    const schema = makeValidationSchema(pages, undefined);
    await expect(schema.validate(response, { abortEarly: false })).resolves.toBeDefined();
  });

  it('enabled: kept on save and its required field enforced', async () => {
    const missingRequired: QuestionnaireResponseItem[] = [
      triggerAnswers({ [REASON]: 'Auto accident' }),
      { linkId: CONDITIONAL_PAGE, item: [] },
    ];

    const values = buildEnableWhenContext(missingRequired);
    expect(evalEnableWhen(conditionalPage as IntakeQuestionnaireItem, pages, values)).toBe(true);

    const filtered = filterDisabledPages(pages, missingRequired);
    expect(filtered.find((p) => p.linkId === CONDITIONAL_PAGE)?.item).toBeDefined();

    const schema = makeValidationSchema(pages, undefined);
    await expect(schema.validate(missingRequired, { abortEarly: false })).rejects.toBeDefined();

    const answered: QuestionnaireResponseItem[] = [
      triggerAnswers({ [REASON]: 'Auto accident' }),
      { linkId: CONDITIONAL_PAGE, item: [{ linkId: 'attorney-name', answer: [{ valueString: 'Meg Mason' }] }] },
    ];
    await expect(schema.validate(answered, { abortEarly: false })).resolves.toBeDefined();
  });
});

describe('nested item gating inside a page (the has-attorney pattern)', () => {
  const HAS_ATTORNEY = 'has-attorney';
  const FIRM_NAME = 'attorney-firm-name';
  const pages = structure([
    {
      linkId: CONDITIONAL_PAGE,
      type: 'group',
      item: [
        { linkId: HAS_ATTORNEY, type: 'string' },
        {
          linkId: FIRM_NAME,
          type: 'string',
          enableWhen: [{ question: HAS_ATTORNEY, operator: '=', answerString: 'I have an attorney' }],
        },
      ],
    },
  ]);
  const firmItem = pages[0].item?.find((i) => i.linkId === FIRM_NAME);

  const contextFor = (hasAttorney?: string): { [linkId: string]: QuestionnaireResponseItem } =>
    buildEnableWhenContext([
      {
        linkId: CONDITIONAL_PAGE,
        item: [{ linkId: HAS_ATTORNEY, ...(hasAttorney ? { answer: [{ valueString: hasAttorney }] } : {}) }],
      },
    ]);

  it('shows the dependent field only when the gate answer matches', () => {
    // buildEnableWhenContext hoists page children to the top level, so a bare linkId
    // question resolves from a nested response.
    const flatItems = pages.flatMap((p) => p.item ?? []);
    expect(evalEnableWhen(firmItem as IntakeQuestionnaireItem, flatItems, contextFor('I have an attorney'))).toBe(true);
    expect(evalEnableWhen(firmItem as IntakeQuestionnaireItem, flatItems, contextFor('No attorney'))).toBe(false);
    expect(evalEnableWhen(firmItem as IntakeQuestionnaireItem, flatItems, contextFor(undefined))).toBe(false);
  });
});

describe('cross-page requireWhen (the workers-comp SSN pattern)', () => {
  const ssnItem: IntakeQuestionnaireItem = {
    linkId: 'patient-ssn',
    type: 'string',
    acceptsMultipleAnswers: false,
    alwaysFilter: false,
    requireWhen: { question: `${TRIGGER_PAGE}.${CATEGORY}`, operator: '=', answerString: 'workers-comp' },
  };

  it('is required exactly when the cross-page condition holds', () => {
    const requiredContext = buildEnableWhenContext([triggerAnswers({ [CATEGORY]: 'workers-comp' })]);
    const optionalContext = buildEnableWhenContext([triggerAnswers({ [CATEGORY]: 'urgent-care' })]);
    expect(evalRequired(ssnItem, requiredContext)).toBe(true);
    expect(evalRequired(ssnItem, optionalContext)).toBe(false);
    expect(evalRequired(ssnItem, buildEnableWhenContext([triggerAnswers({})]))).toBe(false);
  });
});

describe('textWhen substitution (the payment-option display-text pattern)', () => {
  const paymentLabel: IntakeQuestionnaireItem = {
    linkId: 'payment-option-label',
    type: 'display',
    text: 'How would you like to pay for your visit?',
    acceptsMultipleAnswers: false,
    alwaysFilter: false,
    textWhen: [
      {
        question: `${TRIGGER_PAGE}.${CATEGORY}`,
        operator: '=',
        answerString: 'workers-comp',
        substituteText: 'Your visit is covered by workers compensation.',
      },
    ],
  };

  it('substitutes the text when the condition holds and falls back otherwise', () => {
    const wcContext = buildEnableWhenContext([triggerAnswers({ [CATEGORY]: 'workers-comp' })]);
    const ucContext = buildEnableWhenContext([triggerAnswers({ [CATEGORY]: 'urgent-care' })]);
    expect(evalItemText(paymentLabel, wcContext)).toBe('Your visit is covered by workers compensation.');
    expect(evalItemText(paymentLabel, ucContext)).toBe('How would you like to pay for your visit?');
  });
});

describe('filterWhen (the strip-on-save pattern)', () => {
  const filtered: IntakeQuestionnaireItem = {
    linkId: 'search-widget-state',
    type: 'string',
    acceptsMultipleAnswers: false,
    alwaysFilter: false,
    filterWhen: [
      { question: 'manual-entry', operator: '=', answerBoolean: true },
      { question: 'other-flag', operator: '=', answerBoolean: true },
    ],
  };

  it('ORs its conditions: any one holding filters the answer', () => {
    const manualOn = { 'manual-entry': { answer: [{ valueBoolean: true }] } };
    const otherOn = { 'other-flag': { answer: [{ valueBoolean: true }] } };
    const neither = { 'manual-entry': { answer: [{ valueBoolean: false }] } };
    expect(evalFilterWhen(filtered, manualOn)).toBe(true);
    expect(evalFilterWhen(filtered, otherOn)).toBe(true);
    expect(evalFilterWhen(filtered, neither)).toBe(false);
  });

  it('an item with no filterWhen never filters', () => {
    const plain: IntakeQuestionnaireItem = {
      linkId: 'plain',
      type: 'string',
      acceptsMultipleAnswers: false,
      alwaysFilter: false,
    };
    expect(evalFilterWhen(plain, {})).toBe(false);
  });
});

describe('item-level harvest filtering respects enableWhen', () => {
  // The harvest pipeline flattens page children and drops answers whose item definition
  // is disabled by enableWhen — the item-level half of "hidden content never harvests"
  // (the page-level half is filterDisabledPages stripping on submit, above).
  const questionnaire: Questionnaire = {
    resourceType: 'Questionnaire',
    status: 'active',
    item: [
      {
        linkId: CONDITIONAL_PAGE,
        type: 'group',
        item: [
          { linkId: 'gate', type: 'boolean' },
          {
            linkId: 'gated-field',
            type: 'string',
            enableWhen: [{ question: 'gate', operator: '=', answerBoolean: true }],
          },
          { linkId: 'plain-field', type: 'string' },
        ],
      },
    ],
  };

  const responseFor = (gate: boolean): QuestionnaireResponseItem[] => [
    {
      linkId: CONDITIONAL_PAGE,
      item: [
        { linkId: 'gate', answer: [{ valueBoolean: gate }] },
        { linkId: 'gated-field', answer: [{ valueString: 'stale answer' }] },
        { linkId: 'plain-field', answer: [{ valueString: 'kept' }] },
      ],
    },
  ];

  it('drops answers to items whose enableWhen fails and keeps the rest', () => {
    const harvested = prepareQuestionnaireResponseForHarvest({
      questionnaireResponseItems: responseFor(false),
      sourceQuestionnaire: questionnaire,
      options: { filterByEnableWhen: true },
    });
    const linkIds = harvested.map((i) => i.linkId);
    expect(linkIds).not.toContain('gated-field');
    expect(linkIds).toContain('plain-field');
  });

  it('keeps the gated answer when its condition holds', () => {
    const harvested = prepareQuestionnaireResponseForHarvest({
      questionnaireResponseItems: responseFor(true),
      sourceQuestionnaire: questionnaire,
      options: { filterByEnableWhen: true },
    });
    expect(harvested.map((i) => i.linkId)).toContain('gated-field');
  });
});
