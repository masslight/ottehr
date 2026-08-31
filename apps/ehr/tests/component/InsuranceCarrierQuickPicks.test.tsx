import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, ReactNode } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { InsuranceQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockedQuickPicks: InsuranceQuickPickData[] = [];

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  useMergedInsuranceQuickPicks: () => ({ quickPicks: mockedQuickPicks, loading: false, refetch: vi.fn() }),
}));

import { InsuranceCarrierQuickPicks } from '../../src/features/visits/shared/components/patient/InsuranceCarrierQuickPicks';

const CARRIER_KEY = 'insurance-carrier';
const PLAN_TYPE_KEY = 'insurance-plan-type';
const RELATIONSHIP_KEY = 'patient-relationship-to-insured';

const PICKS: InsuranceQuickPickData[] = [
  {
    id: '1',
    name: 'Nomastin Medicaid',
    payerId: 'BLU-001',
    organizationReference: 'Organization/BLU-001',
    organizationDisplay: 'BLU-001 - Blue Cross',
    insuranceType: '10',
    relationship: 'Self',
  },
  {
    id: '2',
    name: 'Nomastin PPO',
    payerId: 'AET-002',
    organizationReference: 'Organization/AET-002',
    organizationDisplay: 'AET-002 - Aetna',
    insuranceType: '12',
  },
];

const FormValueProbe: FC = () => {
  const { watch } = useFormContext();
  const carrier = watch(CARRIER_KEY);
  const planType = watch(PLAN_TYPE_KEY);
  const relationship = watch(RELATIONSHIP_KEY);
  return (
    <>
      <div data-testid="carrier-value">{carrier ? JSON.stringify(carrier) : 'null'}</div>
      <div data-testid="plan-type-value">{planType ?? 'null'}</div>
      <div data-testid="relationship-value">{relationship ?? 'null'}</div>
    </>
  );
};

const Harness: FC<{ children: ReactNode }> = ({ children }) => {
  const methods = useForm({
    defaultValues: { [CARRIER_KEY]: null, [PLAN_TYPE_KEY]: 'existing-type', [RELATIONSHIP_KEY]: 'existing-rel' },
  });
  return (
    <FormProvider {...methods}>
      {children}
      <FormValueProbe />
    </FormProvider>
  );
};

const renderComponent = (): void => {
  render(
    <Harness>
      <InsuranceCarrierQuickPicks
        fieldKey={CARRIER_KEY}
        planTypeFieldKey={PLAN_TYPE_KEY}
        relationshipFieldKey={RELATIONSHIP_KEY}
      />
    </Harness>
  );
};

describe('InsuranceCarrierQuickPicks', () => {
  beforeEach(() => {
    mockedQuickPicks = [];
  });

  it('renders nothing when there are no insurance quick picks configured', () => {
    renderComponent();
    expect(screen.queryByRole('button', { name: /insurance carrier quick picks/i })).not.toBeInTheDocument();
  });

  it('sets carrier (from the payer display), insurance type, and relationship when a full pick is selected', async () => {
    mockedQuickPicks = PICKS;
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /insurance carrier quick picks/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Nomastin Medicaid' }));

    expect(screen.getByTestId('carrier-value').textContent).toBe(
      JSON.stringify({ reference: 'Organization/BLU-001', display: 'BLU-001 - Blue Cross' })
    );
    expect(screen.getByTestId('plan-type-value').textContent).toBe('10');
    expect(screen.getByTestId('relationship-value').textContent).toBe('Self');
  });

  it('leaves the relationship field untouched when the pick does not specify one', async () => {
    mockedQuickPicks = PICKS;
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /insurance carrier quick picks/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Nomastin PPO' }));

    expect(screen.getByTestId('carrier-value').textContent).toBe(
      JSON.stringify({ reference: 'Organization/AET-002', display: 'AET-002 - Aetna' })
    );
    expect(screen.getByTestId('plan-type-value').textContent).toBe('12');
    // Relationship was not specified on the pick, so the existing value remains.
    expect(screen.getByTestId('relationship-value').textContent).toBe('existing-rel');
  });
});
