import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { describe, expect, it, vi } from 'vitest';
import { EmployerInformationContainer } from './EmployerInformationContainer';

// The employer-name picker reads the directory; keep it offline.
const directoryContact: AddressBookContact = vi.hoisted(() => ({
  id: 'c1',
  firstName: 'Jane',
  lastName: 'Doe',
  credential: 'HR Manager',
  organizationName: 'Acme Corp',
  address: { line1: '1 Main St', line2: 'Suite 2', city: 'Springfield', state: 'IL', zip: '62701' },
  phone: '+12125551234',
  fax: '+12125554321',
  email: 'jane@acme.example',
  tags: ['employer'],
}));
vi.mock('src/features/address-book/addressBook.api', () => ({
  searchAddressBook: vi.fn().mockResolvedValue({ contacts: [directoryContact] }),
  createAddressBookContact: vi.fn(),
  updateAddressBookContact: vi.fn(),
  deleteAddressBookContact: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

const employer = PATIENT_RECORD_CONFIG.FormFields.employerInformation.items;

const TestWrapper = ({
  children,
  onFormReady,
}: {
  children: React.ReactNode;
  onFormReady?: (methods: ReturnType<typeof useForm>) => void;
}): JSX.Element => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const TestForm = (): JSX.Element => {
    const defaultValues = Object.fromEntries(Object.values(employer).map((item) => [item.key, '']));
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

describe('EmployerInformationContainer', () => {
  const user = userEvent.setup();

  it('fills the employer and contact fields from a directory contact and marks them dirty', async () => {
    let formMethods: ReturnType<typeof useForm> | null = null;
    render(
      <TestWrapper onFormReady={(methods) => (formMethods = methods)}>
        <EmployerInformationContainer isLoading={false} />
      </TestWrapper>
    );

    await user.click(within(document.getElementById(employer.employerName.key)!).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Jane Doe, HR Manager/ }));

    expect(getFieldInput(employer.employerName.key)).toHaveValue('Acme Corp');
    expect(getFieldInput(employer.addressLine1.key)).toHaveValue('1 Main St');
    expect(getFieldInput(employer.addressLine2.key)).toHaveValue('Suite 2');
    expect(getFieldInput(employer.city.key)).toHaveValue('Springfield');
    expect(getFieldInput(employer.state.key)).toHaveValue('IL');
    expect(getFieldInput(employer.zip.key)).toHaveValue('62701');
    expect(getFieldInput(employer.contactFirstName.key)).toHaveValue('Jane');
    expect(getFieldInput(employer.contactLastName.key)).toHaveValue('Doe');
    expect(getFieldInput(employer.contactTitle.key)).toHaveValue('HR Manager');
    expect(getFieldInput(employer.contactEmail.key)).toHaveValue('jane@acme.example');
    expect(getFieldInput(employer.contactPhone.key)).toHaveValue('(212) 555-1234');
    expect(getFieldInput(employer.contactFax.key)).toHaveValue('(212) 555-4321');
    expect(formMethods!.formState.dirtyFields).toMatchObject({ [employer.state.key]: true });
  });

  it('still takes a free-text employer name', async () => {
    render(
      <TestWrapper>
        <EmployerInformationContainer isLoading={false} />
      </TestWrapper>
    );

    await user.type(within(document.getElementById(employer.employerName.key)!).getByRole('combobox'), 'Globex');

    await waitFor(() => expect(getFieldInput(employer.employerName.key)).toHaveValue('Globex'));
    expect(getFieldInput(employer.addressLine1.key)).toHaveValue('');
  });
});
