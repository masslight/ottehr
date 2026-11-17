import { Operation } from 'fast-json-patch';
import { QuestionnaireItem, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { applyCalculatedAnswers, extractCalculatedItems } from 'utils/lib/helpers/paperwork/calculated-answers';

export const buildFormAnswerPatchOperations = (
  questionnaireResponse: QuestionnaireResponse,
  pages: QuestionnaireResponseItem[]
): Operation[] => {
  const existingPages = questionnaireResponse.item ?? [];
  const operations: Operation[] = [];

  const seen = new Set<string>();
  const dedupedPages = pages.filter((page) => {
    if (seen.has(page.linkId)) return false;
    seen.add(page.linkId);
    return true;
  });

  if (dedupedPages.length === 0) return operations;

  if (questionnaireResponse.item === undefined) {
    operations.push({ op: 'add', path: '/item', value: [] });
  }

  dedupedPages.forEach((page) => {
    const index = existingPages.findIndex((existing) => existing.linkId === page.linkId);
    if (index >= 0) {
      operations.push({ op: 'add', path: `/item/${index}/item`, value: page.item ?? [] });
    } else {
      operations.push({ op: 'add', path: '/item/-', value: { linkId: page.linkId, item: page.item ?? [] } });
    }
  });

  if (questionnaireResponse.status === 'completed') {
    operations.push({ op: 'replace', path: '/status', value: 'amended' });
  }

  return operations;
};

/**
 * Records the calculated values the browser sent on the pages being written. A page that holds calculated items but
 * was not sent (the hidden results page of a scored form is never edited itself) is added, built from what the
 * response currently holds for it. Real answers are never touched.
 */
export const mergeCalculatedAnswersIntoPages = (
  questionnaireResponse: QuestionnaireResponse,
  pages: QuestionnaireResponseItem[],
  calculatedAnswers: QuestionnaireResponseItem[],
  pageDefinitions: Map<string, QuestionnaireItem>
): QuestionnaireResponseItem[] => {
  // a page being written is replaced by the answers sent, which never include calculated items, so the calculated
  // values it already stores are carried over before the new ones are applied
  const merged = pages.map((page) => {
    const definitions = pageDefinitions.get(page.linkId)?.item ?? [];
    const carriedOver = extractCalculatedItems(
      questionnaireResponse.item?.find((existing) => existing.linkId === page.linkId)?.item,
      definitions
    );
    const calculated = calculatedAnswers.find((entry) => entry.linkId === page.linkId);
    return {
      ...page,
      item: applyCalculatedAnswers(
        applyCalculatedAnswers(page.item, carriedOver, definitions),
        calculated?.item ?? [],
        definitions
      ),
    };
  });

  calculatedAnswers
    .filter((entry) => !pages.some((page) => page.linkId === entry.linkId))
    .forEach((entry) => {
      const existing = questionnaireResponse.item?.find((page) => page.linkId === entry.linkId);
      merged.push({
        linkId: entry.linkId,
        item: applyCalculatedAnswers(existing?.item, entry.item ?? [], pageDefinitions.get(entry.linkId)?.item ?? []),
      });
    });

  return merged;
};
