import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The employee list is authoritative for the label; the stored `name` (which
// can be a stale fallback) is only used when the id is absent from the list.

// ─── Mocks (must precede the component import) ──────────────────────────────

let employeesResult: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false };

vi.mock('../../src/features/visits/shared/hooks/useGetEmployees', () => ({
  useGetEmployeesWithDetails: () => employeesResult,
  toProviderDetails: (e: { id: string; name: string }) => ({ practitionerId: e.id, name: e.name }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

import { EmployeeSelectInput } from '../../src/components/input/EmployeeSelectInput';

type OrderedProvider = { id: string; name: string } | null;

const employee = (id: string, name: string): { id: string; name: string } => ({ id, name });

const withEmployees = (nonProviders: ReturnType<typeof employee>[]): void => {
  employeesResult = { data: { providers: [], nonProviders }, isLoading: false };
};

const Harness = ({ value }: { value: OrderedProvider }): ReactElement => {
  const methods = useForm({ defaultValues: { orderedProvider: value } });
  return (
    <FormProvider {...methods}>
      <EmployeeSelectInput name="orderedProvider" label="Ordered by" />
    </FormProvider>
  );
};

describe('EmployeeSelectInput', () => {
  beforeEach(() => {
    employeesResult = { data: undefined, isLoading: false };
  });

  it('labels the selected value from the employee list, not the stale stored name', async () => {
    withEmployees([employee('p1', 'Dr. Real')]);

    render(<Harness value={{ id: 'p1', name: 'Ottehr team' }} />);

    expect(await screen.findByDisplayValue('Dr. Real')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ottehr team')).toBeNull();
  });

  it('renders a loading skeleton instead of the stale label while employees load', () => {
    employeesResult = { data: undefined, isLoading: true };

    render(<Harness value={{ id: 'p1', name: 'Ottehr team' }} />);

    // Skeleton shown → no field to flash the stale label.
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByDisplayValue('Ottehr team')).toBeNull();
  });

  it('falls back to the stored name when the id is not in the employee list', async () => {
    // e.g. a provider who has since left and is no longer an active employee.
    withEmployees([employee('other', 'Someone Else')]);

    render(<Harness value={{ id: 'gone', name: 'Former Provider' }} />);

    expect(await screen.findByDisplayValue('Former Provider')).toBeInTheDocument();
  });
});
