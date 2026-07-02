import {
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  buildEnableWhenContext,
  evalEnableWhen,
  evalFilterWhen,
  evalRequired,
  flattenIntakeQuestionnaireItems,
  IntakeQuestionnaireItem,
  mapQuestionnaireAndValueSetsToItemsList,
} from 'utils';

/**
 * Generates a valid, instance-agnostic set of paperwork answers for a given
 * intake Questionnaire. Rather than hardcoding any one instance's questionnaire
 * version/linkIds/answer set, this walks the questionnaire definition the
 * running instance resolved from its config and synthesizes a type-appropriate
 * answer for every *required* leaf field on every *enabled* page, mirroring the
 * server-side validation logic (evalEnableWhen / evalRequired / evalFilterWhen
 * from `utils`). The result validates as a complete submission for the
 * paperwork zambdas regardless of which instance's questionnaire is in play.
 */

// Produces a valid date string (yyyy-MM-dd) far enough in the past to satisfy a
// `validateAgeOver` constraint while never being in the future.
const pastDateString = (item: IntakeQuestionnaireItem): string => {
  const yearsBack = (item.validateAgeOver ?? 18) + 10;
  return DateTime.now().startOf('day').minus({ years: yearsBack }).toFormat('yyyy-MM-dd');
};

// String value honoring whatever format the field expects (phone/email/zip/ssn),
// inferred the same way the validation schema infers it (dataType or linkId).
const stringValueForItem = (item: IntakeQuestionnaireItem): string => {
  const PHONE_FIELDS = [
    'patient-number',
    'guardian-number',
    'responsible-party-number',
    'pharmacy-phone',
    'pcp-number',
  ];
  const EMAIL_FIELDS = ['patient-email', 'guardian-email'];
  const ZIP_FIELDS = ['patient-zip'];
  if (item.dataType === 'Phone Number' || PHONE_FIELDS.includes(item.linkId)) return '(555) 555-0123';
  if (item.dataType === 'Email' || EMAIL_FIELDS.includes(item.linkId)) return 'integration-test@example.com';
  if (item.dataType === 'ZIP' || ZIP_FIELDS.includes(item.linkId)) return '12345';
  if (item.dataType === 'SSN') return '123-45-6789';
  return 'Integration Test';
};

// Counts how many other fields/pages a given answer value to `item` would pull
// in (via enableWhen/requireWhen `=` conditions referencing it). Used to choose
// the answer option that triggers the fewest downstream required fields — e.g.
// preferring a self-pay payment option over an insurance one, instance-agnostically.
const cascadeCountForValue = (
  linkId: string,
  value: string | undefined,
  allItems: IntakeQuestionnaireItem[]
): number => {
  if (value === undefined) return Number.MAX_SAFE_INTEGER;
  let count = 0;
  for (const it of allItems) {
    for (const ew of it.enableWhen ?? []) {
      if (ew.question === linkId && ew.operator === '=' && ew.answerString === value) count++;
    }
    const rw = it.requireWhen;
    if (rw && rw.question === linkId && rw.operator === '=' && rw.answerString === value) count++;
  }
  return count;
};

const leastCascadingOption = (
  item: IntakeQuestionnaireItem,
  allItems: IntakeQuestionnaireItem[]
): string | undefined => {
  const options = (item.answerOption ?? []).map((o) => o.valueString).filter((v): v is string => v !== undefined);
  if (options.length === 0) return undefined;
  let best = options[0];
  let bestCount = cascadeCountForValue(item.linkId, best, allItems);
  for (const value of options.slice(1)) {
    const c = cascadeCountForValue(item.linkId, value, allItems);
    if (c < bestCount) {
      best = value;
      bestCount = c;
    }
  }
  return best;
};

const answerForLeaf = (
  item: IntakeQuestionnaireItem,
  allItems: IntakeQuestionnaireItem[]
): QuestionnaireResponseItemAnswer[] | undefined => {
  switch (item.type) {
    case 'boolean':
      return [{ valueBoolean: item.requiredBooleanValue ?? true }];
    case 'decimal':
      return [{ valueDecimal: 1 }];
    case 'attachment':
      return [
        {
          valueAttachment: {
            url: 'https://example.com/integration-test-attachment.pdf',
            contentType: 'application/pdf',
            title: 'integration-test-attachment.pdf',
          },
        },
      ];
    case 'date':
      return [{ valueString: pastDateString(item) }];
    case 'choice':
    case 'open-choice': {
      if (item.answerOption && item.answerOption.length > 0) {
        return [{ valueString: leastCascadingOption(item, allItems) }];
      }
      if (item.answerLoadingOptions?.answerSource) {
        // reference-backed choice — value must be a syntactically valid FHIR reference (uuid)
        return [
          {
            valueReference: {
              reference: 'Organization/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              display: 'Integration Test',
            },
          },
        ];
      }
      // value-set-backed or free choice — any non-empty string passes validation
      return [{ valueString: stringValueForItem(item) }];
    }
    case 'text':
    case 'string':
      return [{ valueString: stringValueForItem(item) }];
    default:
      return undefined;
  }
};

const buildAnswersForFields = (
  fields: IntakeQuestionnaireItem[],
  context: Record<string, any>,
  allItems: IntakeQuestionnaireItem[]
): QuestionnaireResponseItem[] => {
  const out: QuestionnaireResponseItem[] = [];
  for (const field of fields) {
    if (field.type === 'display' || field.readOnly) continue;
    if (evalFilterWhen(field, context)) continue;

    if (field.type === 'group') {
      const children = buildAnswersForFields(field.item ?? [], context, allItems);
      if (children.length > 0) {
        out.push({ linkId: field.linkId, item: children });
      }
      continue;
    }

    if (!evalRequired(field, context)) continue;
    const answer = answerForLeaf(field, allItems);
    if (answer) out.push({ linkId: field.linkId, answer });
  }
  return out;
};

/**
 * Walks the questionnaire's pages and produces a full QuestionnaireResponse item
 * list (one entry per enabled page, each with its required answers). Iterates to
 * a fixpoint because filling a field may enable a previously-disabled page or
 * flip a `requireWhen` condition on another field.
 */
export const generatePaperworkAnswers = (
  questionnaire: Questionnaire,
  questionnaireResponse?: QuestionnaireResponse
): QuestionnaireResponseItem[] => {
  const pages = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);
  const allItems = flattenIntakeQuestionnaireItems(pages);

  let answers: QuestionnaireResponseItem[] = [];
  for (let pass = 0; pass < 6; pass++) {
    const context = buildEnableWhenContext(answers);
    const next: QuestionnaireResponseItem[] = [];
    for (const page of pages) {
      if (!evalEnableWhen(page, pages, context, questionnaireResponse)) continue;
      const pageItems = buildAnswersForFields(page.item ?? [], context, allItems);
      next.push({ linkId: page.linkId, item: pageItems });
    }
    const stable = JSON.stringify(next) === JSON.stringify(answers);
    answers = next;
    if (stable) break;
  }
  return answers;
};

/** Returns the answers for a single enabled page, for patch-paperwork (which patches one page). */
export const generatePageAnswers = (
  questionnaire: Questionnaire,
  pageLinkId: string,
  questionnaireResponse?: QuestionnaireResponse
): QuestionnaireResponseItem | undefined => {
  const full = generatePaperworkAnswers(questionnaire, questionnaireResponse);
  return full.find((p) => p.linkId === pageLinkId);
};

/** Returns the linkId of the first enabled page that has at least one answerable field. */
export const firstAnswerablePageLinkId = (questionnaire: Questionnaire): string | undefined => {
  const full = generatePaperworkAnswers(questionnaire);
  return full.find((p) => (p.item?.length ?? 0) > 0)?.linkId;
};
