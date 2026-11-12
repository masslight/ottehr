import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('src/api/api', () => ({
  createNursingOrder: vi.fn().mockResolvedValue({}),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ patient: { id: 'pat-1' }, encounter: { id: 'enc-nursing-blank-note' } }),
}));

vi.mock('../../src/features/nursing-orders/components/BreadCrumbs', () => ({
  BreadCrumbs: () => <div />,
}));

import { NursingOrderCreatePage } from '../../src/features/nursing-orders/pages/NursingOrderCreatePage';
import { useNursingOrderStore } from '../../src/state/draft-data.store';

describe('NursingOrderCreatePage Order button with a blank note', () => {
  beforeEach(() => {
    useNursingOrderStore.setState({ draftsByEncounterId: {} });
  });

  it('keeps Order disabled while the note is whitespace only', async () => {
    const user = userEvent.setup();
    render(<NursingOrderCreatePage />);

    await user.type(screen.getByRole('textbox', { name: /order note/i }), '   ');

    expect(screen.getByRole('button', { name: 'Order' })).toBeDisabled();
  });

  it('enables Order for a note with surrounding spaces and keeps the spaces in the field', async () => {
    const user = userEvent.setup();
    render(<NursingOrderCreatePage />);

    await user.type(screen.getByRole('textbox', { name: /order note/i }), ' check BP ');

    expect(screen.getByRole('textbox', { name: /order note/i })).toHaveValue(' check BP ');
    expect(screen.getByRole('button', { name: 'Order' })).toBeEnabled();
  });
});
