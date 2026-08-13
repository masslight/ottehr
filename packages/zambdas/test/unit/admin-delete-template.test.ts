import { List } from 'fhir/r4b';
import { GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { describe, expect, test } from 'vitest';
import { makeRemoveTemplateFromHolderOps } from '../../src/ehr/admin-delete-template/index';

const makeHolderList = (referencedListIds: (string | undefined)[]): List => ({
  resourceType: 'List',
  id: 'holder-1',
  status: 'current',
  mode: 'working',
  meta: { tag: [{ system: GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM, code: 'global-templates' }] },
  entry: referencedListIds.map((id) => ({
    item: id ? { reference: `List/${id}` } : {},
  })),
});

// The holder list is shared mutable state written by concurrent template creates and
// deletes; delete removes its entry via patchWithOptimisticLock, which recomputes these
// ops against the exact resource version its If-Match header pins. That contract makes
// two properties load-bearing: indices must match the version passed in, and multiple
// removes must be ordered so earlier ops don't shift the indices of later ones.
describe('makeRemoveTemplateFromHolderOps', () => {
  test('removes the single entry referencing the template', () => {
    const holder = makeHolderList(['other-a', 'target', 'other-b']);
    expect(makeRemoveTemplateFromHolderOps(holder, 'target')).toEqual([{ op: 'remove', path: '/entry/1' }]);
  });

  test('returns no ops when the template is not referenced (already unlinked by another writer)', () => {
    const holder = makeHolderList(['other-a', 'other-b']);
    expect(makeRemoveTemplateFromHolderOps(holder, 'target')).toEqual([]);
  });

  test('returns no ops when the holder has no entry array', () => {
    const holder = makeHolderList([]);
    delete holder.entry;
    expect(makeRemoveTemplateFromHolderOps(holder, 'target')).toEqual([]);
  });

  test('removes duplicate references in descending index order so earlier removes keep later indices valid', () => {
    const holder = makeHolderList(['target', 'other-a', 'target']);
    expect(makeRemoveTemplateFromHolderOps(holder, 'target')).toEqual([
      { op: 'remove', path: '/entry/2' },
      { op: 'remove', path: '/entry/0' },
    ]);
  });

  test('ignores entries without an item reference', () => {
    const holder = makeHolderList([undefined, 'target']);
    expect(makeRemoveTemplateFromHolderOps(holder, 'target')).toEqual([{ op: 'remove', path: '/entry/1' }]);
  });

  test('does not match a template id that is a prefix or suffix of another reference', () => {
    const holder = makeHolderList(['target-longer', 'target']);
    expect(makeRemoveTemplateFromHolderOps(holder, 'target')).toEqual([{ op: 'remove', path: '/entry/1' }]);
  });
});
