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
  useAppointmentData: () => ({ patient: { id: 'pat-1' }, encounter: { id: 'enc-nursing-test' } }),
}));

vi.mock('src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../../src/features/nursing-orders/components/BreadCrumbs', () => ({
  BreadCrumbs: () => <div />,
}));

import { NursingOrderCreatePage } from '../../src/features/nursing-orders/pages/NursingOrderCreatePage';
import { useNursingOrderStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-nursing-test';

describe('NursingOrderCreatePage — draft behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNursingOrderStore.setState({ draftsByEncounterId: {} });
  });

  describe('banner visibility', () => {
    it('does not show the banner when the draft store is empty', () => {
      render(<NursingOrderCreatePage />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the in-progress banner when a draft exists', () => {
      useNursingOrderStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Check blood pressure' });

      render(<NursingOrderCreatePage />);

      expect(screen.getByRole('alert')).toHaveTextContent('nursing order in progress');
    });

    it('shows the restored banner when hasNavigatedAway is true', () => {
      useNursingOrderStore.getState().setDraft(ENCOUNTER_ID, {
        notes: 'Check blood pressure',
        hasNavigatedAway: true,
      });

      render(<NursingOrderCreatePage />);

      expect(screen.getByRole('alert')).toHaveTextContent('previously entered data has been restored');
    });
  });

  describe('Clear Form button visibility', () => {
    it('renders a Clear Form button when a draft exists', () => {
      useNursingOrderStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Check blood pressure' });

      render(<NursingOrderCreatePage />);

      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });

    it('does not render a Clear Form button when no draft exists', () => {
      render(<NursingOrderCreatePage />);

      expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
    });
  });

  describe('form population from draft', () => {
    it('populates the Order note field from the draft on mount', () => {
      useNursingOrderStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Check blood pressure' });

      render(<NursingOrderCreatePage />);

      expect(screen.getByRole('textbox', { name: /order note/i })).toHaveValue('Check blood pressure');
    });
  });

  describe('Clear Form interaction', () => {
    it('clicking Clear Form clears the draft store', async () => {
      useNursingOrderStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Check blood pressure' });
      const user = userEvent.setup();

      render(<NursingOrderCreatePage />);
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(useNursingOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('clicking Clear Form resets the Order note field to empty', async () => {
      useNursingOrderStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Check blood pressure' });
      const user = userEvent.setup();

      render(<NursingOrderCreatePage />);
      expect(screen.getByRole('textbox', { name: /order note/i })).toHaveValue('Check blood pressure');

      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByRole('textbox', { name: /order note/i })).toHaveValue('');
    });
  });
});
