import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderingProviderDialog, ServiceLineOrderingProvider } from '../../src/components/claim/OrderingProviderDialog';

// Stable across renders, like the real hook's, so the dialog's reset-on-open effect runs once.
const providerSearch = { options: [], search: (): void => {} };
vi.mock('../../src/hooks/useOptionSearch', () => ({
  useProviderOptionsSearch: () => providerSearch,
}));

const renderDialog = (value: ServiceLineOrderingProvider | null = null): ReturnType<typeof vi.fn> => {
  const onSave = vi.fn();
  render(<OrderingProviderDialog open value={value} onSave={onSave} onClose={() => {}} />);
  return onSave;
};

const saveButton = (): HTMLElement => screen.getByRole('button', { name: 'Save' });

describe('OrderingProviderDialog', () => {
  it('saves a manually entered provider with its first and last name', () => {
    const onSave = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Enter manually' }));

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: ' Jane ' } });
    expect(saveButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Outside' } });
    fireEvent.change(screen.getByLabelText('NPI'), { target: { value: '1234567893' } });
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Outside',
      npi: '1234567893',
    });
  });

  it('prefills the name parts of a manually entered provider', () => {
    renderDialog({ firstName: 'Jane', lastName: 'Outside' });

    expect(screen.getByLabelText('First name')).toHaveValue('Jane');
    expect(screen.getByLabelText('Last name')).toHaveValue('Outside');
  });

  it('does not save a manually entered provider missing a name part', () => {
    renderDialog({ firstName: 'Jane', lastName: 'Outside' });

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: ' ' } });
    expect(saveButton()).toBeDisabled();
  });
});
