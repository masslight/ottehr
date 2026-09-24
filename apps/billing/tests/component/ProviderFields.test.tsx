import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { ProviderAddressFields, ProviderFields } from '../../src/components/ProviderFields';
import { emptyProviderForm, ProviderForm } from '../../src/constants/provider';

function TestForm({
  onSubmit,
  overrides,
}: {
  onSubmit: (data: ProviderForm) => void;
  overrides?: Partial<ProviderForm>;
}): JSX.Element {
  const methods = useForm<ProviderForm>({
    defaultValues: {
      ...emptyProviderForm('rendering'),
      firstName: 'Ada',
      lastName: 'Lovelace',
      npi: '1234567893',
      licenseType: 'MD',
      licenseNumber: 'A12345',
      licenseState: 'CA',
      taxonomyCode: '207Q00000X',
      ...overrides,
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

  it('requires license number and state', async () => {
    const onSubmit = vi.fn();
    render(<TestForm onSubmit={onSubmit} overrides={{ licenseNumber: '', licenseState: '' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('This field is required')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
