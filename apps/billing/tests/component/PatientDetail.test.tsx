import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PatientDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PatientDetail from '../../src/pages/PatientDetail';

const {
  getBillingPatientDetailMock,
  getPatientCoveragesMock,
  listBillingPatientAccountPaymentsMock,
  oystehrZambdaStub,
} = vi.hoisted(() => ({
  getBillingPatientDetailMock: vi.fn(),
  getPatientCoveragesMock: vi.fn(),
  listBillingPatientAccountPaymentsMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingPatientDetail: getBillingPatientDetailMock,
  getPatientCoverages: getPatientCoveragesMock,
  listBillingPatientAccountPayments: listBillingPatientAccountPaymentsMock,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: oystehrZambdaStub }),
}));

const patient = {
  id: 'p-1',
  firstName: 'Jane',
  lastName: 'Doe',
  dob: '1990-01-01',
  clinicalId: 'clinical-1',
  clinicalFriendlyId: '',
  balance: { currentBalance: 0, claimsWithPatientBalance: 0, pendingPayments: 0 },
  claims: [],
} as unknown as PatientDetailResponse;

const deferPatient = (): ((value: PatientDetailResponse) => void) => {
  let resolvePatient: (value: PatientDetailResponse) => void = () => undefined;
  getBillingPatientDetailMock.mockImplementation(
    () =>
      new Promise<PatientDetailResponse>((resolve) => {
        resolvePatient = resolve;
      })
  );
  return (value) => resolvePatient(value);
};

const renderAt = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetail />} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  getPatientCoveragesMock.mockResolvedValue({ coverages: [] });
  listBillingPatientAccountPaymentsMock.mockResolvedValue({ payments: [], visits: [] });
});

describe('PatientDetail loading', () => {
  it('loads the insurance tab while the patient is still loading, and only once', async () => {
    const resolvePatient = deferPatient();
    renderAt('/patients/p-1?tab=insurance');

    expect(getPatientCoveragesMock).toHaveBeenCalledWith(oystehrZambdaStub, { patientId: 'p-1' });
    expect(screen.queryByText('Doe, Jane')).not.toBeInTheDocument();

    await act(async () => resolvePatient(patient));

    expect(await screen.findByText('Doe, Jane')).toBeInTheDocument();
    expect(await screen.findByText('No insurance coverages on file.')).toBeInTheDocument();
    expect(getPatientCoveragesMock).toHaveBeenCalledOnce();
  });

  it('loads the payments tab while the patient is still loading, and only once', async () => {
    const resolvePatient = deferPatient();
    renderAt('/patients/p-1?tab=payments');

    expect(listBillingPatientAccountPaymentsMock).toHaveBeenCalledWith(oystehrZambdaStub, { patientId: 'p-1' });

    await act(async () => resolvePatient(patient));

    expect(await screen.findByText('Doe, Jane')).toBeInTheDocument();
    expect(listBillingPatientAccountPaymentsMock).toHaveBeenCalledOnce();
  });

  it('shows the error instead of the tabs when the patient cannot be loaded', async () => {
    getBillingPatientDetailMock.mockRejectedValue(new Error('Patient not found'));
    renderAt('/patients/p-1?tab=insurance');

    expect(await screen.findByRole('alert')).toHaveTextContent('Patient not found');
    expect(screen.queryByRole('tab', { name: 'Insurance' })).not.toBeInTheDocument();
  });
});
