import { QuestionnaireItem, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4b';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../fhir/constants';
import { IntakeQuestionnaireItem } from '../../types/data/paperwork/paperwork.types';

/**
 * Scored forms have a results page (a top level group with disabled-display: hidden) that is never rendered to the
 * patient. Its items carry a javascript expression (score-form-expression extension, mapped to `scoreExpression`)
 * that is evaluated against the patient's answers to fill in that item's answer.
 */

export type ScoreAnswerContext = Record<string, unknown>;

// a top level page the patient never sees, e.g. a scored form's results page
export const isHiddenPage = (page: Pick<IntakeQuestionnaireItem, 'disabledDisplay'>): boolean =>
  page.disabledDisplay === 'hidden';

// same as isHiddenPage, for raw fhir questionnaire items (before extensions are mapped)
export const isHiddenPageQItem = (page: Pick<QuestionnaireItem, 'extension'> | undefined): boolean =>
  Boolean(
    page?.extension?.some(
      (ext) => ext.url === OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.disabledDisplay && ext.valueString === 'hidden'
    )
  );

export const getVisiblePages = <T extends Pick<IntakeQuestionnaireItem, 'disabledDisplay'>>(pages: T[]): T[] =>
  pages.filter((page) => !isHiddenPage(page));

const hasScoreExpression = (item: IntakeQuestionnaireItem): boolean =>
  Boolean(item.scoreExpression) || (item.item ?? []).some(hasScoreExpression);

export const hasScoring = (items: IntakeQuestionnaireItem[]): boolean =>
  items.some((page) => isHiddenPage(page) && hasScoreExpression(page));

const answerToContextValue = (answer: QuestionnaireResponseItemAnswer): unknown => {
  if (answer.valueCoding) {
    const { code } = answer.valueCoding;
    // coded answers on scored forms carry their point value as the code
    return code !== undefined && code.trim() !== '' && !isNaN(Number(code)) ? Number(code) : code;
  }
  if (answer.valueBoolean !== undefined) return answer.valueBoolean;
  if (answer.valueInteger !== undefined) return answer.valueInteger;
  if (answer.valueDecimal !== undefined) return answer.valueDecimal;
  if (answer.valueString !== undefined) return answer.valueString;
  if (answer.valueDate !== undefined) return answer.valueDate;
  if (answer.valueDateTime !== undefined) return answer.valueDateTime;
  return undefined;
};

/**
 * Formats QR answers as { linkId: answer } for score expressions.
 * Multiple answers are passed as an array.
 */
export const buildAnswerContext = (
  qrItems: QuestionnaireResponseItem[],
  context: ScoreAnswerContext = {}
): ScoreAnswerContext => {
  for (const item of qrItems) {
    const values = (item.answer ?? []).map(answerToContextValue).filter((v) => v !== undefined);
    if (values.length === 1) context[item.linkId] = values[0];
    else if (values.length > 1) context[item.linkId] = values;
    if (item.item) buildAnswerContext(item.item, context);
  }
  return context;
};

// passed as parameters but never given a value, so inside an expression these names are undefined rather than the
// real globals. guards against accidental access, it is not a sandbox (expressions are authored by our internal team)
const SHADOWED_GLOBALS = ['process', 'require', 'fetch', 'globalThis', 'window', 'self'];

export const evaluateScoreExpression = (
  expression: string,
  answers: ScoreAnswerContext
): { ok: true; value: unknown } | { ok: false; error: string } => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('answers', ...SHADOWED_GLOBALS, `with(answers) { return (${expression}); }`);
    return { ok: true, value: fn({ ...answers }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const valueToAnswer = (item: IntakeQuestionnaireItem, value: unknown): QuestionnaireResponseItemAnswer | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && !isFinite(value)) return undefined;

  switch (item.type) {
    case 'boolean':
      return { valueBoolean: Boolean(value) };
    case 'integer': {
      const num = Number(value);
      return isFinite(num) ? { valueInteger: Math.round(num) } : undefined;
    }
    case 'decimal': {
      const num = Number(value);
      return isFinite(num) ? { valueDecimal: num } : undefined;
    }
    default:
      return { valueString: String(value) };
  }
};

const scoreItems = (items: IntakeQuestionnaireItem[], answers: ScoreAnswerContext): QuestionnaireResponseItem[] =>
  items.map((item) => {
    if (item.item?.length) {
      return { linkId: item.linkId, item: scoreItems(item.item, answers) };
    }
    if (!item.scoreExpression) return { linkId: item.linkId };

    const result = evaluateScoreExpression(item.scoreExpression, answers);
    if (!result.ok) {
      console.error(`Failed to evaluate score expression for linkId ${item.linkId}: ${result.error}`);
      return { linkId: item.linkId };
    }

    const answer = valueToAnswer(item, result.value);
    if (!answer) {
      console.warn(`Score expression for linkId ${item.linkId} did not produce a usable value`, result.value);
      return { linkId: item.linkId };
    }

    // later results can reference earlier ones (e.g. a positive screen derived from a total)
    answers[item.linkId] = result.value;
    return { linkId: item.linkId, answer: [answer] };
  });

/**
 * Evaluates every score expression on the questionnaire's hidden pages, in document order, and returns the QR items
 * with those pages' items replaced by the computed results. Returns qrItems unchanged when there is no scoring.
 */
export const computeScores = (
  items: IntakeQuestionnaireItem[],
  qrItems: QuestionnaireResponseItem[]
): QuestionnaireResponseItem[] => {
  if (!hasScoring(items)) return qrItems;

  // hidden page answers are never patient input, so they are left out of the context (avoids stale results leaking in)
  const hiddenPageLinkIds = new Set(items.filter(isHiddenPage).map((page) => page.linkId));
  const answers = buildAnswerContext(qrItems.filter((qrItem) => !hiddenPageLinkIds.has(qrItem.linkId)));

  const result = [...qrItems];
  items.forEach((page, pageIndex) => {
    if (!isHiddenPage(page) || !hasScoreExpression(page)) return;

    const scoredPage: QuestionnaireResponseItem = { linkId: page.linkId, item: scoreItems(page.item ?? [], answers) };

    const existingIndex = result.findIndex((qrItem) => qrItem.linkId === page.linkId);
    if (existingIndex >= 0) {
      result[existingIndex] = scoredPage;
      return;
    }

    // keep the QR in questionnaire order: insert before the first QR page that comes later in the questionnaire
    const laterPageLinkIds = new Set(items.slice(pageIndex + 1).map((p) => p.linkId));
    const insertAt = result.findIndex((qrItem) => laterPageLinkIds.has(qrItem.linkId));
    if (insertAt >= 0) result.splice(insertAt, 0, scoredPage);
    else result.push(scoredPage);
  });

  return result;
};

/**
 * Removes scoring details from items sent to patients: hidden pages keep only their shell (top level indices are used
 * when patching paperwork, so the page itself stays) and score expressions are dropped.
 */
export const stripScoringForPatient = (items: IntakeQuestionnaireItem[]): IntakeQuestionnaireItem[] =>
  items.map((page) => {
    if (isHiddenPage(page)) return { ...page, item: [] };
    return stripScoreExpressions(page);
  });

const stripScoreExpressions = (item: IntakeQuestionnaireItem): IntakeQuestionnaireItem => {
  const { scoreExpression: _scoreExpression, ...rest } = item;
  return rest.item ? { ...rest, item: rest.item.map(stripScoreExpressions) } : rest;
};

/**
 * Removes computed results from a QR sent to patients (e.g. when re-opening a submitted form). They are recomputed
 * on every submit, so nothing is lost.
 */
export const stripScoresFromQuestionnaireResponse = <T extends { item?: QuestionnaireResponseItem[] }>(
  items: IntakeQuestionnaireItem[],
  questionnaireResponse: T
): T => {
  const hiddenPageLinkIds = new Set(items.filter(isHiddenPage).map((page) => page.linkId));
  if (hiddenPageLinkIds.size === 0) return questionnaireResponse;

  return {
    ...questionnaireResponse,
    item: questionnaireResponse.item?.map((page) =>
      hiddenPageLinkIds.has(page.linkId) ? { linkId: page.linkId, item: [] } : page
    ),
  };
};
