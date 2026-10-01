import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { describe, expect, it, vi } from 'vitest';
import { AttorneyInformationContainer } from './AttorneyInformationContainer';

// The firm picker reads the directory; keep it offline.
const directoryContact: AddressBookContact = vi.hoisted(() => ({
  id: 'c1',
  firstName: 'Saul',
  lastName: 'Goodman',
  organizationName: 'Goodman & Associates',
  phone: '+12125551234',
  fax: '+12125554321',
  email: 'saul@goodman.example',
  tags: ['attorney'],
}));
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({ contacts: [directoryContact] }),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

const attorney = PATIENT_RECORD_CONFIG.FormFields.attorneyInformation.items;

const TestWrapper = ({
  children,
  onFormReady,
}: {
  children: React.ReactNode;
  onFormReady?: (methods: ReturnType<typeof useForm>) => void;
}): JSX.Element => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const TestForm = (): JSX.Element => {
    const defaultValues = Object.fromEntries(Object.values(attorney).map((item) => [item.key, '']));
    const methods = useForm({ defaultValues });
    React.useEffect(() => {
      onFormReady?.(methods);
    }, [methods]);
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
  return (
    <QueryClientProvider client={queryClient}>
      <TestForm />
    </QueryClientProvider>
  );
};

const getFieldInput = (fieldKey: string): HTMLInputElement => {
  const input = document.querySelector(`input[name="${fieldKey}"]`);
  if (!input) throw new Error(`Input with name "${fieldKey}" not found`);
  return input as HTMLInputElement;
};

describe('AttorneyInformationContainer', () => {
  const user = userEvent.setup();

  it('fills the attorney fields from a directory contact and marks them dirty', async () => {
    let formMethods: ReturnType<typeof useForm> | null = null;
    render(
      <TestWrapper onFormReady={(methods) => (formMethods = methods)}>
        <AttorneyInformationContainer isLoading={false} />
      </TestWrapper>
    );

    await user.click(within(document.getElementById(attorney.firm.key)!).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Saul Goodman/ }));

    expect(getFieldInput(attorney.firm.key)).toHaveValue('Goodman & Associates');
    expect(getFieldInput(attorney.firstName.key)).toHaveValue('Saul');
    expect(getFieldInput(attorney.lastName.key)).toHaveValue('Goodman');
    expect(getFieldInput(attorney.email.key)).toHaveValue('saul@goodman.example');
    expect(getFieldInput(attorney.mobile.key)).toHaveValue('(212) 555-1234');
    expect(getFieldInput(attorney.fax.key)).toHaveValue('(212) 555-4321');
    expect(formMethods!.formState.dirtyFields).toMatchObject({ [attorney.firstName.key]: true });
  });

  it('still takes a free-text firm name', async () => {
    render(
      <TestWrapper>
        <AttorneyInformationContainer isLoading={false} />
      </TestWrapper>
    );

    await user.type(within(document.getElementById(attorney.firm.key)!).getByRole('combobox'), 'Some Firm');

    await waitFor(() => expect(getFieldInput(attorney.firm.key)).toHaveValue('Some Firm'));
    expect(getFieldInput(attorney.firstName.key)).toHaveValue('');
  });
});
