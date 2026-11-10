import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RoleType, User } from 'utils/lib/types/api/user.types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {}, oystehrZambda: {} as any }) }));

vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'admin-1', hasRole: () => true }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'admin-1', hasRole: () => true }) }));

import EmployeeInformationForm from '../../src/components/EmployeeInformation';
import { dataTestIds } from '../../src/constants/data-test-ids';

const provider = {
  id: 'u-1',
  name: 'provider@x.com',
  email: 'provider@x.com',
  profile: 'Practitioner/abc',
  roles: [{ id: 'r-provider', name: RoleType.Provider }],
} as unknown as User;

const renderForm = (): void => {
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  render(
    <EmployeeInformationForm
      submitLabel="Save changes"
      existingUser={provider}
      isActive={true}
      licenses={[]}
      seenPatientRecently={false}
      getUserAndUpdatePage={async () => undefined}
    />,
    { wrapper }
  );
};

describe('EmployeeInformationForm add license', () => {
  it('flags a whitespace-only license number as missing on Add', async () => {
    renderForm();
    const numberInput = screen
      .getByTestId(dataTestIds.employeesPage.newQualificationNumberField)
      .querySelector('input')!;

    fireEvent.change(numberInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId(dataTestIds.employeesPage.addQualificationButton));

    expect(await screen.findByText('Please select a state')).toBeInTheDocument();
    expect(screen.getByText('Please enter license number')).toBeInTheDocument();
  });
});
