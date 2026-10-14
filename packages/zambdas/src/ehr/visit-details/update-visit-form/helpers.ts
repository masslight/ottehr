import { Operation } from 'fast-json-patch';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';

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
