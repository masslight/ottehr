import { beforeEach, describe, expect, test } from 'vitest';
import { useCommandPaletteStore } from '../../src/state/command-palette.store';

describe('command-palette.store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useCommandPaletteStore.setState({
      isOpen: false,
      sources: {},
      pendingQuickPick: null,
    });
  });

  describe('open/close/toggle', () => {
    test('open sets isOpen to true', () => {
      useCommandPaletteStore.getState().open();
      expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    });

    test('close sets isOpen to false', () => {
      useCommandPaletteStore.getState().open();
      useCommandPaletteStore.getState().close();
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    });

    test('toggle flips isOpen', () => {
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
      useCommandPaletteStore.getState().toggle();
      expect(useCommandPaletteStore.getState().isOpen).toBe(true);
      useCommandPaletteStore.getState().toggle();
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    });
  });

  describe('source registration', () => {
    test('registerSource adds a source with items', () => {
      const items = [{ id: 'test-1', label: 'Test Item', category: 'Test', onSelect: () => {} }];
      useCommandPaletteStore.getState().registerSource('test-source', items);
      const sources = useCommandPaletteStore.getState().sources;
      expect(sources['test-source']).toBeDefined();
      expect(sources['test-source'].items).toEqual(items);
    });

    test('registerSource replaces items for existing source', () => {
      const items1 = [{ id: 'a', label: 'A', category: 'Cat', onSelect: () => {} }];
      const items2 = [{ id: 'b', label: 'B', category: 'Cat', onSelect: () => {} }];
      useCommandPaletteStore.getState().registerSource('src', items1);
      useCommandPaletteStore.getState().registerSource('src', items2);
      expect(useCommandPaletteStore.getState().sources['src'].items).toEqual(items2);
    });

    test('unregisterSource removes a source', () => {
      const items = [{ id: 'x', label: 'X', category: 'C', onSelect: () => {} }];
      useCommandPaletteStore.getState().registerSource('to-remove', items);
      expect(useCommandPaletteStore.getState().sources['to-remove']).toBeDefined();
      useCommandPaletteStore.getState().unregisterSource('to-remove');
      expect(useCommandPaletteStore.getState().sources['to-remove']).toBeUndefined();
    });

    test('unregisterSource is no-op for unknown source', () => {
      useCommandPaletteStore.getState().unregisterSource('nonexistent');
      expect(Object.keys(useCommandPaletteStore.getState().sources)).toHaveLength(0);
    });

    test('multiple sources coexist independently', () => {
      const items1 = [{ id: 'a', label: 'A', category: 'C1', onSelect: () => {} }];
      const items2 = [{ id: 'b', label: 'B', category: 'C2', onSelect: () => {} }];
      useCommandPaletteStore.getState().registerSource('s1', items1);
      useCommandPaletteStore.getState().registerSource('s2', items2);
      expect(Object.keys(useCommandPaletteStore.getState().sources)).toHaveLength(2);
      useCommandPaletteStore.getState().unregisterSource('s1');
      expect(Object.keys(useCommandPaletteStore.getState().sources)).toHaveLength(1);
      expect(useCommandPaletteStore.getState().sources['s2'].items).toEqual(items2);
    });
  });

  describe('pendingQuickPick', () => {
    test('setPendingQuickPick stores the pending pick', () => {
      const pending = { category: 'allergies', itemId: 'penicillin', payload: { name: 'Penicillin' } };
      useCommandPaletteStore.getState().setPendingQuickPick(pending);
      expect(useCommandPaletteStore.getState().pendingQuickPick).toEqual(pending);
    });

    test('setPendingQuickPick(null) clears the pending pick', () => {
      useCommandPaletteStore.getState().setPendingQuickPick({
        category: 'test',
        itemId: 'x',
        payload: {},
      });
      useCommandPaletteStore.getState().setPendingQuickPick(null);
      expect(useCommandPaletteStore.getState().pendingQuickPick).toBeNull();
    });
  });
});
