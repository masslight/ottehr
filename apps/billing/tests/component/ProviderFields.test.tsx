import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { ProviderAddressFields, ProviderFields } from '../../src/components/ProviderFields';
import { emptyProviderForm, ProviderForm } from '../../src/constants/provider';

function TestForm({
  onSubmit,
  licenses = [{ type: 'MD', number: 'A12345', state: 'CA' }],
}: {
  onSubmit: (data: ProviderForm) => void;
  licenses?: ProviderForm['licenses'];
}): JSX.Element {
  const methods = useForm<ProviderForm>({
    defaultValues: {
      ...emptyProviderForm('rendering'),
      firstName: 'Ada',
      lastName: 'Lovelace',
      npi: '1234567893',
      licenses,
      taxonomyCode: '207Q00000X',
    },
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <ProviderFields />
        <ProviderAddressFields />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

describe('ProviderFields', () => {
  it('requires Tax ID and address only when the provider bills', async () => {
    const onSubmit = vi.fn();
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bills medical services' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('This field is required')).toHaveLength(5);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('requires license number and state for every license', async () => {
    const onSubmit = vi.fn();
    render(<TestForm onSubmit={onSubmit} licenses={[{ type: 'MD', number: '', state: '' }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('This field is required')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('supports multiple licenses and keeps at least one', async () => {
    const onSubmit = vi.fn();
    render(<TestForm onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Remove license 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add License' }));
    expect(screen.getAllByLabelText('License Number *')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Remove license 1' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove license 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].licenses).toEqual([{ type: 'MD', number: 'A12345', state: 'CA' }]);
  });

  it('rejects the same license type twice in one state', async () => {
    const onSubmit = vi.fn();
    render(
      <TestForm
        onSubmit={onSubmit}
        licenses={[
          { type: 'MD', number: 'A1', state: 'CA' },
          { type: 'MD', number: 'A2', state: 'CA' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('Duplicate license type for this state')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
