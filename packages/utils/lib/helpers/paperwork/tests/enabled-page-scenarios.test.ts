import { Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { assert, describe, expect, it } from 'vitest';
import { BOOKING_CONFIG } from '../../../ottehr-config/booking';
import { IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE } from '../../../ottehr-config/intake-paperwork';
import { VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE } from '../../../ottehr-config/intake-paperwork-virtual';
import { OCC_MED_EMPLOYER_PAY_OPTION, OCC_MED_SELF_PAY_OPTION } from '../../../ottehr-config/value-sets';
import { IntakeQuestionnaireItem } from '../../../types/data/paperwork/paperwork.types';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import { filterDisabledPages } from '../validation';

/**
 * The enabled-page-set scenario matrix: for every service category the booking config
 * declares (× reason-for-visit × occ-med payment option), assert EXACTLY which pages of
 * the real generated questionnaires are disabled. This pins the paperwork's page-level
 * shape per scenario — the thing per-instance e2e used to walk a browser to observe —
 * as a fast, deterministic table.
 *
 * Assertions are written as exact disabled-page sets (not enabled sets) so adding a new
 * unconditional page never breaks them, while any change to conditional behavior does.
 * The category list is read from BOOKING_CONFIG, so when an instance overlay adds a
 * category, this suite fails loudly until an expectation for it is added.
 *
 * In-person and virtual questionnaires have different page sets and different conditional
 * logic, so they each get their own baseline map. Key differences:
 * - In-person lacks attorney-mva-page (present in virtual).
 * - In-person gates pcp/pharmacy/emergency-contact on category = urgent-care; virtual
 *   shows them unconditionally.
 */

const CONTACT_PAGE = 'contact-information-page';
const SERVICE_CATEGORY = 'appointment-service-category';
const REASON_FOR_VISIT = 'reason-for-visit';
const OCC_MED_PAYMENT_PAGE = 'payment-option-occ-med-page';
const OCC_MED_PAYMENT_QUESTION = 'payment-option-occupational';

// Pages present in BOTH questionnaires (used for shared assertions)
const SHARED_PAGES = {
  paymentOption: 'payment-option-page',
  occMedPaymentOption: OCC_MED_PAYMENT_PAGE,
  occMedEmployer: 'occupational-medicine-employer-information-page',
  cardPayment: 'card-payment-page',
  wcEmployer: 'employer-information-page',
  consent: 'consent-forms-page',
  pcp: 'primary-care-physician-page',
} as const;

// Pages present only in the virtual questionnaire
const VIRTUAL_ONLY_PAGES = {
  attorney: 'attorney-mva-page',
} as const;

interface Scenario {
  category?: string;
  reasonForVisit?: string;
  occMedPayment?: string;
}

interface ModeUnderTest {
  mode: string;
  pages: IntakeQuestionnaireItem[];
  baselineDisabledByCategory: Record<string, string[]>;
  /** Expected disabled-page set when no service category is answered */
  noCategoryDisabled: string[];
}

const structureMode = (
  mode: string,
  questionnaire: Questionnaire,
  baselineDisabledByCategory: Record<string, string[]>,
  noCategoryDisabled: string[]
): ModeUnderTest => ({
  mode,
  pages: mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []),
  baselineDisabledByCategory,
  noCategoryDisabled,
});

/**
 * In-person baseline: pcp/pharmacy/emergency-contact are only enabled for urgent-care,
 * so they appear in the disabled set for other categories. No attorney-mva-page exists.
 */
const IN_PERSON_BASELINE_DISABLED_BY_CATEGORY: Record<string, string[]> = {
  'urgent-care': [SHARED_PAGES.occMedPaymentOption, SHARED_PAGES.occMedEmployer, SHARED_PAGES.wcEmployer],
  'occupational-medicine': [
    SHARED_PAGES.paymentOption,
    SHARED_PAGES.wcEmployer,
    SHARED_PAGES.pcp,
    'pharmacy-page',
    'emergency-contact-page',
    'responsible-party-page',
  ],
  'workers-comp': [
    SHARED_PAGES.occMedPaymentOption,
    SHARED_PAGES.occMedEmployer,
    SHARED_PAGES.cardPayment,
    SHARED_PAGES.pcp,
    'pharmacy-page',
    'emergency-contact-page',
  ],
};

/**
 * When no category is answered in the in-person Q, every category-gated page is
 * disabled: = urgent-care pages hide, = occ-med pages hide, = workers-comp pages hide,
 * while != pages remain visible (no answer passes the != check).
 */
const IN_PERSON_NO_CATEGORY_DISABLED: string[] = [
  'emergency-contact-page',
  SHARED_PAGES.wcEmployer,
  SHARED_PAGES.occMedEmployer,
  SHARED_PAGES.occMedPaymentOption,
  'pharmacy-page',
  SHARED_PAGES.pcp,
];

/**
 * Virtual baseline: pcp/pharmacy/emergency-contact are unconditionally enabled;
 * attorney-mva-page is enabled only for Auto accident reason for visit.
 */
const VIRTUAL_BASELINE_DISABLED_BY_CATEGORY: Record<string, string[]> = {
  'urgent-care': [
    SHARED_PAGES.occMedPaymentOption,
    SHARED_PAGES.occMedEmployer,
    SHARED_PAGES.wcEmployer,
    VIRTUAL_ONLY_PAGES.attorney,
  ],
  'occupational-medicine': [SHARED_PAGES.paymentOption, SHARED_PAGES.wcEmployer, VIRTUAL_ONLY_PAGES.attorney],
  'workers-comp': [
    SHARED_PAGES.occMedPaymentOption,
    SHARED_PAGES.occMedEmployer,
    SHARED_PAGES.cardPayment,
    VIRTUAL_ONLY_PAGES.attorney,
  ],
};

/**
 * For virtual with no category: same as urgent-care shape (pcp/pharmacy/emergency are
 * unconditional; attorney is hidden for non-auto-accident).
 */
const VIRTUAL_NO_CATEGORY_DISABLED: string[] = [
  VIRTUAL_ONLY_PAGES.attorney,
  SHARED_PAGES.wcEmployer,
  SHARED_PAGES.occMedEmployer,
  SHARED_PAGES.occMedPaymentOption,
];

const MODES: ModeUnderTest[] = [
  structureMode(
    'in-person',
    IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE(),
    IN_PERSON_BASELINE_DISABLED_BY_CATEGORY,
    IN_PERSON_NO_CATEGORY_DISABLED
  ),
  structureMode(
    'virtual',
    VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE(),
    VIRTUAL_BASELINE_DISABLED_BY_CATEGORY,
    VIRTUAL_NO_CATEGORY_DISABLED
  ),
];

const buildScenarioResponse = (pages: IntakeQuestionnaireItem[], scenario: Scenario): QuestionnaireResponseItem[] =>
  pages.map((page) => {
    if (page.linkId === CONTACT_PAGE) {
      return {
        linkId: CONTACT_PAGE,
        item: [
          {
            linkId: SERVICE_CATEGORY,
            ...(scenario.category ? { answer: [{ valueString: scenario.category }] } : {}),
          },
          {
            linkId: REASON_FOR_VISIT,
            ...(scenario.reasonForVisit ? { answer: [{ valueString: scenario.reasonForVisit }] } : {}),
          },
          { linkId: 'patient-will-be-18', answer: [{ valueBoolean: true }] },
        ],
      };
    }
    if (page.linkId === OCC_MED_PAYMENT_PAGE && scenario.occMedPayment) {
      return {
        linkId: OCC_MED_PAYMENT_PAGE,
        item: [{ linkId: OCC_MED_PAYMENT_QUESTION, answer: [{ valueString: scenario.occMedPayment }] }],
      };
    }
    return { linkId: page.linkId, item: [] };
  });

const disabledPagesFor = (pages: IntakeQuestionnaireItem[], scenario: Scenario): string[] => {
  const result = filterDisabledPages(pages, buildScenarioResponse(pages, scenario));
  return result
    .filter((page) => !('item' in page))
    .map((page) => page.linkId)
    .sort();
};

const sorted = (linkIds: string[]): string[] => [...linkIds].sort();

describe('conditional pages exist in both service modes', () => {
  for (const { mode, pages } of MODES) {
    it(`${mode} questionnaire contains every shared page the matrix pins`, () => {
      const pageLinkIds = new Set(pages.map((p) => p.linkId));
      for (const linkId of Object.values(SHARED_PAGES)) {
        expect(pageLinkIds, `expected ${mode} questionnaire to contain ${linkId}`).toContain(linkId);
      }
    });
  }

  it('virtual questionnaire contains attorney-mva-page', () => {
    const virtualPages = MODES.find((m) => m.mode === 'virtual')!.pages;
    const pageLinkIds = new Set(virtualPages.map((p) => p.linkId));
    for (const linkId of Object.values(VIRTUAL_ONLY_PAGES)) {
      expect(pageLinkIds, `expected virtual questionnaire to contain ${linkId}`).toContain(linkId);
    }
  });
});

describe('every configured service category has a pinned expectation', () => {
  it('BOOKING_CONFIG categories are all covered by the in-person matrix', () => {
    const configuredCodes = BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code);
    expect(configuredCodes.length).toBeGreaterThan(0);
    for (const code of configuredCodes) {
      assert(
        code !== undefined && IN_PERSON_BASELINE_DISABLED_BY_CATEGORY[code] !== undefined,
        `service category '${code}' has no expected disabled-page set in the in-person matrix — ` +
          `add one so its paperwork shape is certified`
      );
    }
  });

  it('BOOKING_CONFIG categories are all covered by the virtual matrix', () => {
    const configuredCodes = BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code);
    expect(configuredCodes.length).toBeGreaterThan(0);
    for (const code of configuredCodes) {
      assert(
        code !== undefined && VIRTUAL_BASELINE_DISABLED_BY_CATEGORY[code] !== undefined,
        `service category '${code}' has no expected disabled-page set in the virtual matrix — ` +
          `add one so its paperwork shape is certified`
      );
    }
  });
});

describe.each(MODES.map((m) => [m.mode, m] as const))(
  'enabled-page sets — %s',
  (_mode, { pages, baselineDisabledByCategory, noCategoryDisabled }) => {
    describe.each(Object.entries(baselineDisabledByCategory))('category %s', (category, baselineDisabled) => {
      it('pins the disabled-page set for an ordinary reason for visit', () => {
        expect(disabledPagesFor(pages, { category, reasonForVisit: 'Fever' })).toEqual(sorted(baselineDisabled));
      });

      it('an Auto accident reason additionally enables the attorney page', () => {
        const expected = baselineDisabled.filter((linkId) => linkId !== VIRTUAL_ONLY_PAGES.attorney);
        expect(disabledPagesFor(pages, { category, reasonForVisit: 'Auto accident' })).toEqual(sorted(expected));
      });
    });

    describe('occupational medicine payment variants', () => {
      it('employer pay additionally disables the card-payment page', () => {
        const expected = [...baselineDisabledByCategory['occupational-medicine'], SHARED_PAGES.cardPayment];
        expect(
          disabledPagesFor(pages, {
            category: 'occupational-medicine',
            reasonForVisit: 'Fever',
            occMedPayment: OCC_MED_EMPLOYER_PAY_OPTION,
          })
        ).toEqual(sorted(expected));
      });

      it('self pay keeps the card-payment page enabled', () => {
        expect(
          disabledPagesFor(pages, {
            category: 'occupational-medicine',
            reasonForVisit: 'Fever',
            occMedPayment: OCC_MED_SELF_PAY_OPTION,
          })
        ).toEqual(sorted(baselineDisabledByCategory['occupational-medicine']));
      });

      // With no payment answer yet (mid-flow), the card-payment page is enabled: its
      // '!= employer' condition evaluates true against a missing answer. Pinned so the
      // engine semantics the config leans on can't silently change.
      it('an unanswered payment option leaves the card-payment page enabled', () => {
        expect(disabledPagesFor(pages, { category: 'occupational-medicine', reasonForVisit: 'Fever' })).toEqual(
          sorted(baselineDisabledByCategory['occupational-medicine'])
        );
      });
    });

    // Before prepopulation lands (or for a category-less booking), the paperwork behaves
    // like a plain visit: category '=' pages hide, '!=' pages show.
    it('an unanswered service category produces the expected no-category disabled set', () => {
      expect(disabledPagesFor(pages, { reasonForVisit: 'Fever' })).toEqual(sorted(noCategoryDisabled));
    });
  }
);
