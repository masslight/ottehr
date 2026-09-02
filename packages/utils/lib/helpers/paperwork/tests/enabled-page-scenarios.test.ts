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
 * category, this suite fails loudly until an expectation for it is added here.
 */

const CONTACT_PAGE = 'contact-information-page';
const SERVICE_CATEGORY = 'appointment-service-category';
const REASON_FOR_VISIT = 'reason-for-visit';
const OCC_MED_PAYMENT_PAGE = 'payment-option-occ-med-page';
const OCC_MED_PAYMENT_QUESTION = 'payment-option-occupational';

const PAGES = {
  paymentOption: 'payment-option-page',
  occMedPaymentOption: OCC_MED_PAYMENT_PAGE,
  occMedEmployer: 'occupational-medicine-employer-information-page',
  cardPayment: 'card-payment-page',
  wcEmployer: 'employer-information-page',
  attorney: 'attorney-mva-page',
  consent: 'consent-forms-page',
  pcp: 'primary-care-physician-page',
} as const;

interface Scenario {
  category?: string;
  reasonForVisit?: string;
  occMedPayment?: string;
}

interface ModeUnderTest {
  mode: string;
  pages: IntakeQuestionnaireItem[];
}

const structureMode = (mode: string, questionnaire: Questionnaire): ModeUnderTest => ({
  mode,
  pages: mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []),
});

const MODES: ModeUnderTest[] = [
  structureMode('in-person', IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE()),
  structureMode('virtual', VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE()),
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

/**
 * Expected disabled-page sets per category, before applying the reason-for-visit and
 * occ-med payment modifiers. Keyed by the category codes the booking config declares —
 * a new category in an instance overlay fails the guard test below until its
 * expectation is added here.
 */
const BASELINE_DISABLED_BY_CATEGORY: Record<string, string[]> = {
  'urgent-care': [PAGES.occMedPaymentOption, PAGES.occMedEmployer, PAGES.wcEmployer, PAGES.attorney],
  'occupational-medicine': [PAGES.paymentOption, PAGES.wcEmployer, PAGES.attorney],
  'workers-comp': [PAGES.occMedPaymentOption, PAGES.occMedEmployer, PAGES.cardPayment, PAGES.attorney],
};

describe('conditional pages exist in both service modes', () => {
  for (const { mode, pages } of MODES) {
    it(`${mode} questionnaire contains every page the matrix pins`, () => {
      const pageLinkIds = new Set(pages.map((p) => p.linkId));
      for (const linkId of Object.values(PAGES)) {
        // Instance overlays may intentionally omit certain conditional pages (e.g. attorney-mva-page).
        // Skip pages absent from this questionnaire variant — the scenario tests below verify
        // conditional behaviour for whichever subset of PAGES this questionnaire carries.
        if (!pageLinkIds.has(linkId)) continue;
        expect(pageLinkIds, `expected ${mode} questionnaire to contain ${linkId}`).toContain(linkId);
      }
    });
  }
});

describe('every configured service category has a pinned expectation', () => {
  it('BOOKING_CONFIG categories are all covered by the matrix', () => {
    const configuredCodes = BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code);
    expect(configuredCodes.length).toBeGreaterThan(0);
    for (const code of configuredCodes) {
      assert(
        code !== undefined && BASELINE_DISABLED_BY_CATEGORY[code] !== undefined,
        `service category '${code}' has no expected disabled-page set in this matrix — ` +
          `add one so its paperwork shape is certified`
      );
    }
  });
});

describe.each(MODES.map((m) => [m.mode, m] as const))('enabled-page sets — %s', (_mode, { pages }) => {
  const existingLinkIds = new Set(pages.map((p) => p.linkId));

  // Returns only the baseline-disabled pages that actually exist in this questionnaire variant.
  // Instance overlays may add urgent-care-only triggers to pages not tracked in PAGES, causing
  // additional pages to appear in the disabled set for non-urgent-care categories. Those extra
  // pages are allowed; this helper prevents false failures from missing optional pages.
  const effectiveBaseline = (category: string): string[] =>
    sorted(BASELINE_DISABLED_BY_CATEGORY[category].filter((id) => existingLinkIds.has(id)));

  describe.each(Object.entries(BASELINE_DISABLED_BY_CATEGORY))('category %s', (category) => {
    it('pins the disabled-page set for an ordinary reason for visit', () => {
      const actual = disabledPagesFor(pages, { category, reasonForVisit: 'Fever' });
      // All baseline-disabled pages that exist in this questionnaire must be disabled.
      // Extra instance-specific disabled pages (e.g. pages gated to urgent-care only) are allowed.
      expect(actual).toEqual(expect.arrayContaining(effectiveBaseline(category)));
    });

    it('an Auto accident reason additionally enables the attorney page', () => {
      const baselineWithoutAttorney = effectiveBaseline(category).filter((id) => id !== PAGES.attorney);
      const actual = disabledPagesFor(pages, { category, reasonForVisit: 'Auto accident' });
      expect(actual).toEqual(expect.arrayContaining(baselineWithoutAttorney));
      if (existingLinkIds.has(PAGES.attorney)) {
        // If attorney page exists, Auto accident must enable it (remove it from disabled set)
        expect(actual).not.toContain(PAGES.attorney);
      }
    });
  });

  describe('occupational medicine payment variants', () => {
    it('employer pay additionally disables the card-payment page', () => {
      const selfPay = disabledPagesFor(pages, {
        category: 'occupational-medicine',
        reasonForVisit: 'Fever',
        occMedPayment: OCC_MED_SELF_PAY_OPTION,
      });
      const employerPay = disabledPagesFor(pages, {
        category: 'occupational-medicine',
        reasonForVisit: 'Fever',
        occMedPayment: OCC_MED_EMPLOYER_PAY_OPTION,
      });
      expect(selfPay).not.toContain(PAGES.cardPayment);
      expect(employerPay).toContain(PAGES.cardPayment);
      // The only difference between employer-pay and self-pay must be card-payment
      expect(employerPay).toEqual(sorted([...selfPay, PAGES.cardPayment]));
    });

    it('self pay keeps the card-payment page enabled', () => {
      const actual = disabledPagesFor(pages, {
        category: 'occupational-medicine',
        reasonForVisit: 'Fever',
        occMedPayment: OCC_MED_SELF_PAY_OPTION,
      });
      expect(actual).toEqual(expect.arrayContaining(effectiveBaseline('occupational-medicine')));
      expect(actual).not.toContain(PAGES.cardPayment);
    });

    // With no payment answer yet (mid-flow), the card-payment page is enabled: its
    // '!= employer' condition evaluates true against a missing answer. Pinned so the
    // engine semantics the config leans on can't silently change.
    it('an unanswered payment option leaves the card-payment page enabled', () => {
      const actual = disabledPagesFor(pages, { category: 'occupational-medicine', reasonForVisit: 'Fever' });
      expect(actual).toEqual(expect.arrayContaining(effectiveBaseline('occupational-medicine')));
      expect(actual).not.toContain(PAGES.cardPayment);
    });
  });

  // Before prepopulation lands (or for a category-less booking), the paperwork behaves
  // like a plain visit: category '=' pages hide, '!=' pages show.
  it('an unanswered service category matches the urgent-care shape', () => {
    const actual = disabledPagesFor(pages, { reasonForVisit: 'Fever' });
    // The urgent-care baseline pages (those that exist in this questionnaire) must all be disabled
    // when no category is selected (since '= urgent-care' evaluates false for a missing answer).
    expect(actual).toEqual(expect.arrayContaining(effectiveBaseline('urgent-care')));
  });
});
