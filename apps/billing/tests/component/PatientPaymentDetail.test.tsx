import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { BillingPatientAccountPayment } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PatientPaymentDetail from '../../src/pages/PatientPaymentDetail';

const { getBillingPatientAccountPaymentMock, oystehrZambdaStub } = vi.hoisted(() => ({
  getBillingPatientAccountPaymentMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingPatientAccountPayment: getBillingPatientAccountPaymentMock,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: oystehrZambdaStub }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  useEvolveUser: () => ({ currentUser: { hasRole: () => true }, isLoadingUser: false }),
}));

vi.mock('../../src/hooks/usePatient', () => ({
  usePatient: () => [undefined],
}));

const payment = (id: string, encounterId: string, amountInCents: number): BillingPatientAccountPayment =>
  ({
    paymentMethod: 'cash',
    amountInCents,
    dateISO: '2026-09-01',
    recordedDateISO: '2026-09-01T11:00:00.000Z',
    fhirPaymentNotificationId: id,
    encounterId,
    method: 'cash',
  }) as BillingPatientAccountPayment;

// each call returns a promise the test settles by hand, so responses can arrive in any order
const deferredCalls = (): ((value: BillingPatientAccountPayment) => void)[] => {
  const resolvers: ((value: BillingPatientAccountPayment) => void)[] = [];
  getBillingPatientAccountPaymentMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvers.push((value) => resolve({ payment: value }));
      })
  );
  return resolvers;
};

const renderAt = (path: string): ReturnType<typeof createMemoryRouter> => {
  const router = createMemoryRouter(
    [
      { path: '/patients/:id/encounters/:encounterId/payments/:paymentId', element: <PatientPaymentDetail /> },
      { path: '*', element: <div>elsewhere</div> },
    ],
    { initialEntries: [path] }
  );
  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PatientPaymentDetail loading', () => {
  it("ignores a previous route's response that arrives after the current one", async () => {
    const resolvers = deferredCalls();
    const router = renderAt('/patients/p-1/encounters/enc-1/payments/pn-a');
    await act(() => router.navigate('/patients/p-1/encounters/enc-2/payments/pn-b'));
    expect(resolvers).toHaveLength(2);

    await act(async () => resolvers[1](payment('pn-b', 'enc-2', 2000)));
    await act(async () => resolvers[0](payment('pn-a', 'enc-1', 1000)));

    expect(await screen.findAllByText('$20.00')).not.toHaveLength(0);
    expect(screen.queryByText('$10.00')).toBeNull();
    expect(router.state.location.pathname).toBe('/patients/p-1/encounters/enc-2/payments/pn-b');
  });

  it('does not redirect to a resolved payment id once the page has been left', async () => {
    const resolvers = deferredCalls();
    const router = renderAt('/patients/p-1/encounters/enc-1/payments/pn-legacy');
    await act(() => router.navigate('/patients/p-1'));

    // the legacy payment resolves to its billing copy, which would rewrite the URL if still current
    await act(async () => resolvers[0](payment('pn-adopted', 'enc-1', 1000)));

    expect(router.state.location.pathname).toBe('/patients/p-1');
  });

  it('switches the URL to the resolved id without loading the payment again', async () => {
    const resolvers = deferredCalls();
    const router = renderAt('/patients/p-1/encounters/enc-1/payments/pn-legacy');

    await act(async () => resolvers[0](payment('pn-adopted', 'enc-1', 1000)));

    expect(router.state.location.pathname).toBe('/patients/p-1/encounters/enc-1/payments/pn-adopted');
    expect(await screen.findAllByText('$10.00')).not.toHaveLength(0);
    expect(getBillingPatientAccountPaymentMock).toHaveBeenCalledTimes(1);
  });
});
