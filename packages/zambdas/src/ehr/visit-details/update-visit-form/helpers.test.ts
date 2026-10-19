import { Operation } from 'fast-json-patch';
import { QuestionnaireResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { buildFormAnswerPatchOperations } from './helpers';

const qr = (overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  status: 'completed',
  ...overrides,
});

describe('buildFormAnswerPatchOperations', () => {
  it('rewrites a page in place by linkId, not by the order the client sent it in', () => {
    const response = qr({
      item: [
        { linkId: 'page-one', item: [{ linkId: 'q1', answer: [{ valueString: 'old' }] }] },
        { linkId: 'page-two', item: [{ linkId: 'q2', answer: [{ valueString: 'untouched' }] }] },
      ],
    });

    const operations = buildFormAnswerPatchOperations(response, [
      { linkId: 'page-two', item: [{ linkId: 'q2', answer: [{ valueString: 'new' }] }] },
    ]);

    expect(operations).toEqual([
      { op: 'add', path: '/item/1/item', value: [{ linkId: 'q2', answer: [{ valueString: 'new' }] }] },
      { op: 'replace', path: '/status', value: 'amended' },
    ]);
  });

  // The edit dialog submits only the pages the staff member actually stepped through, so every
  // page it leaves out has to survive the patch untouched.
  it('emits no operation for pages the caller did not submit', () => {
    const response = qr({
      item: [
        { linkId: 'page-one', item: [{ linkId: 'q1', answer: [{ valueString: 'a' }] }] },
        { linkId: 'page-two', item: [{ linkId: 'q2', answer: [{ valueString: 'b' }] }] },
      ],
    });

    const operations = buildFormAnswerPatchOperations(response, [{ linkId: 'page-one', item: [] }]);

    expect(operations.filter((op) => op.path.startsWith('/item'))).toEqual([
      { op: 'add', path: '/item/0/item', value: [] },
    ]);
  });

  // 'add' rather than 'replace' for the answers: a page item that was created with no `item` key at
  // all has no value at /item/<i>/item for 'replace' to target, and JSON Patch 'add' both creates
  // and overwrites an object member.
  it('writes answers onto a page item that carries no item key yet', () => {
    const response = qr({ item: [{ linkId: 'page-one' }] });

    const operations = buildFormAnswerPatchOperations(response, [
      { linkId: 'page-one', item: [{ linkId: 'q1', answer: [{ valueString: 'first' }] }] },
    ]);

    expect(operations[0]).toEqual({
      op: 'add',
      path: '/item/0/item',
      value: [{ linkId: 'q1', answer: [{ valueString: 'first' }] }],
    });
  });

  // A response only carries the pages that were answered, so a page a patient never reached is
  // absent. Note this branch is not what handles a page the flow de-duplicated away: that page's
  // linkId is still present, held by the form that survived, which is why the caller's form identity
  // is checked in complexValidation rather than here.
  it('appends a page the response does not carry yet', () => {
    const response = qr({ item: [{ linkId: 'page-one', item: [] }] });

    const operations = buildFormAnswerPatchOperations(response, [
      { linkId: 'page-missing', item: [{ linkId: 'q9', answer: [{ valueBoolean: true }] }] },
    ]);

    expect(operations[0]).toEqual({
      op: 'add',
      path: '/item/-',
      value: { linkId: 'page-missing', item: [{ linkId: 'q9', answer: [{ valueBoolean: true }] }] },
    });
  });

  it('creates the item array before appending when the response has none', () => {
    const operations = buildFormAnswerPatchOperations(qr(), [{ linkId: 'page-one', item: [] }]);

    expect(operations.slice(0, 2)).toEqual([
      { op: 'add', path: '/item', value: [] },
      { op: 'add', path: '/item/-', value: { linkId: 'page-one', item: [] } },
    ]);
  });

  // Mirrors patch-paperwork: a staff correction to a submitted response is an amendment, and only a
  // response that had reached 'completed' has anything to amend.
  it("moves a completed response to 'amended' and leaves any other status alone", () => {
    const statusOp = (status: QuestionnaireResponse['status']): Operation[] =>
      buildFormAnswerPatchOperations(qr({ status, item: [{ linkId: 'page-one', item: [] }] }), [
        { linkId: 'page-one', item: [] },
      ]).filter((op) => op.path === '/status');

    expect(statusOp('completed')).toEqual([{ op: 'replace', path: '/status', value: 'amended' }]);
    expect(statusOp('in-progress')).toEqual([]);
    expect(statusOp('amended')).toEqual([]);
  });

  it('touches nothing when no pages are submitted', () => {
    expect(buildFormAnswerPatchOperations(qr({ item: [{ linkId: 'page-one', item: [] }] }), [])).toEqual([]);
  });

  it('keeps the first of two submissions for the same page', () => {
    const response = qr({ item: [{ linkId: 'page-one', item: [] }] });

    const operations = buildFormAnswerPatchOperations(response, [
      { linkId: 'page-one', item: [{ linkId: 'q1', answer: [{ valueString: 'kept' }] }] },
      { linkId: 'page-one', item: [{ linkId: 'q1', answer: [{ valueString: 'dropped' }] }] },
    ]);

    expect(operations.filter((op) => op.path.startsWith('/item'))).toEqual([
      { op: 'add', path: '/item/0/item', value: [{ linkId: 'q1', answer: [{ valueString: 'kept' }] }] },
    ]);
  });
});
