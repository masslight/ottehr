import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, ReactNode } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { InsuranceQuickPickData } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockedQuickPicks: InsuranceQuickPickData[] = [];

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  useMergedInsuranceQuickPicks: () => ({ quickPicks: mockedQuickPicks, loading: false, refetch: vi.fn() }),
}));

import { InsuranceCarrierQuickPicks } from '../../src/features/visits/shared/components/patient/InsuranceCarrierQuickPicks';

const PICKS: InsuranceQuickPickData[] = [
  { id: '1', name: 'BLU-001 - Blue Cross', payerId: 'BLU-001', organizationReference: 'Organization/BLU-001' },
  { id: '2', name: 'AET-002 - Aetna', payerId: 'AET-002', organizationReference: 'Organization/AET-002' },
];

const FIELD_KEY = 'insurance-carrier';

const FormValueProbe: FC = () => {
  const { watch } = useFormContext();
  const value = watch(FIELD_KEY);
  return <div data-testid="form-value">{value ? JSON.stringify(value) : 'null'}</div>;
};

const Harness: FC<{ children: ReactNode }> = ({ children }) => {
  const methods = useForm({ defaultValues: { [FIELD_KEY]: null } });
  return (
    <FormProvider {...methods}>
      {children}
      <FormValueProbe />
    </FormProvider>
  );
};

describe('InsuranceCarrierQuickPicks', () => {
  beforeEach(() => {
    mockedQuickPicks = [];
  });

  it('renders nothing when there are no insurance quick picks configured', () => {
    render(
      <Harness>
        <InsuranceCarrierQuickPicks fieldKey={FIELD_KEY} />
      </Harness>
    );

    expect(screen.queryByRole('button', { name: /quick picks/i })).not.toBeInTheDocument();
  });

  it('sets the carrier field to a Reference when a quick pick is selected', async () => {
    mockedQuickPicks = PICKS;
    const user = userEvent.setup();

    render(
      <Harness>
        <InsuranceCarrierQuickPicks fieldKey={FIELD_KEY} />
      </Harness>
    );

    await user.click(screen.getByRole('button', { name: /quick picks/i }));
    await user.click(screen.getByRole('menuitem', { name: 'AET-002 - Aetna' }));

    expect(screen.getByTestId('form-value').textContent).toBe(
      JSON.stringify({ reference: 'Organization/AET-002', display: 'AET-002 - Aetna' })
    );
  });
});
