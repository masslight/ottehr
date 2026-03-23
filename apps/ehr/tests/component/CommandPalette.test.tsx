import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/hooks/useGlobalQuickPicks', () => ({
  useGlobalQuickPicks: vi.fn(),
}));

vi.mock('src/hooks/useNavigationQuickPicks', () => ({
  useNavigationQuickPicks: vi.fn(),
}));

import { CommandPalette } from '../../src/components/CommandPalette';
import { useCommandPaletteStore } from '../../src/state/command-palette.store';

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const wrapper = ({ children }: { children: ReactNode }): ReactNode => <BrowserRouter>{children}</BrowserRouter>;

const registerTestItems = (): void => {
  useCommandPaletteStore.getState().registerSource('test-allergies', [
    { id: 'allergy-penicillin', label: 'Penicillin', category: 'Add Allergy', onSelect: vi.fn() },
    { id: 'allergy-sulfa', label: 'Sulfa', category: 'Add Allergy', onSelect: vi.fn() },
  ]);
  useCommandPaletteStore
    .getState()
    .registerSource('test-procedures', [
      { id: 'proc-lac-repair', label: 'Laceration Repair', category: 'Add Procedure', onSelect: vi.fn() },
    ]);
};

describe('CommandPalette', () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({
      isOpen: false,
      sources: {},
      pendingQuickPick: null,
    });
  });

  it('does not render dialog when closed', () => {
    render(<CommandPalette />, { wrapper });
    expect(screen.queryByPlaceholderText(/search by patient/i)).not.toBeInTheDocument();
  });

  it('renders dialog when opened via store', () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });
    expect(screen.getByPlaceholderText(/search by patient/i)).toBeInTheDocument();
  });

  it('shows all registered items when no query', () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Sulfa')).toBeInTheDocument();
    expect(screen.getByText('Laceration Repair')).toBeInTheDocument();
  });

  it('shows category headers', () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });
    // Category headers use CSS textTransform uppercase, actual text is title case
    expect(screen.getByText('Add Allergy')).toBeInTheDocument();
    expect(screen.getByText('Add Procedure')).toBeInTheDocument();
  });

  it('filters items by query', () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    const input = screen.getByPlaceholderText(/search by patient/i);
    fireEvent.change(input, { target: { value: 'penic' } });

    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.queryByText('Sulfa')).not.toBeInTheDocument();
    expect(screen.queryByText('Laceration Repair')).not.toBeInTheDocument();
  });

  it('filters by category name', () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    const input = screen.getByPlaceholderText(/search by patient/i);
    fireEvent.change(input, { target: { value: 'procedure' } });

    expect(screen.getByText('Laceration Repair')).toBeInTheDocument();
    expect(screen.queryByText('Penicillin')).not.toBeInTheDocument();
  });

  it('shows patient search fallback when no items match', () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    const input = screen.getByPlaceholderText(/search by patient/i);
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText(/search patients for/i)).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    const input = screen.getByPlaceholderText(/search by patient/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('selects item on Enter key', () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    const input = screen.getByPlaceholderText(/search by patient/i);
    fireEvent.change(input, { target: { value: 'penic' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Palette should close after selection
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('navigates selection with arrow keys', () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    const input = screen.getByPlaceholderText(/search by patient/i);

    // First item should be selected by default
    const firstItem = screen.getByText('Penicillin').closest('[data-selected]');
    expect(firstItem?.getAttribute('data-selected')).toBe('true');

    // Arrow down moves selection
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const secondItem = screen.getByText('Sulfa').closest('[data-selected]');
    expect(secondItem?.getAttribute('data-selected')).toBe('true');
  });

  it('opens with Cmd+K keyboard shortcut', async () => {
    render(<CommandPalette />, { wrapper });

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    });
  });

  it('toggles closed with Cmd+K when already open', async () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    });
  });

  it('does not open when focus is in an input element', () => {
    render(
      <div>
        <input data-testid="other-input" />
        <CommandPalette />
      </div>,
      { wrapper }
    );

    const otherInput = screen.getByTestId('other-input');
    otherInput.focus();
    fireEvent.keyDown(otherInput, { key: 'k', metaKey: true, bubbles: true });

    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('resets query when reopened', async () => {
    registerTestItems();
    useCommandPaletteStore.getState().open();
    const { unmount } = render(<CommandPalette />, { wrapper });

    const input = screen.getByPlaceholderText(/search by patient/i);
    fireEvent.change(input, { target: { value: 'test query' } });

    useCommandPaletteStore.getState().close();
    unmount();

    useCommandPaletteStore.getState().open();
    render(<CommandPalette />, { wrapper });

    const newInput = screen.getByPlaceholderText(/search by patient/i);
    expect((newInput as HTMLInputElement).value).toBe('');
  });
});
