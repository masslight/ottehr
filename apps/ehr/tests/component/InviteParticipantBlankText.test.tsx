import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InviteParticipant from '../../src/features/visits/telemed/components/appointment/InviteParticipant';

const inviteParticipant = vi.fn();
vi.mock('../../src/api/api', () => ({
  inviteParticipant: (...args: unknown[]) => inviteParticipant(...args),
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

const fill = async (user: ReturnType<typeof userEvent.setup>, values: Record<string, string>): Promise<void> => {
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(new RegExp(`^${label}`)), value);
  }
};

const renderDialog = (): void => {
  render(
    <MemoryRouter>
      <InviteParticipant modalOpen onClose={vi.fn()} />
    </MemoryRouter>
  );
};

describe('InviteParticipant blank text', () => {
  beforeEach(() => {
    inviteParticipant.mockReset();
  });

  it.each(['First Name', 'Last Name', 'Phone'])(
    'keeps Send Invite disabled for a whitespace-only %s',
    async (blank) => {
      const user = userEvent.setup();
      renderDialog();

      await fill(user, {
        'First Name': 'Jane',
        'Last Name': 'Doe',
        Phone: '2025550143',
        Email: 'jane@example.com',
        [blank]: '',
      });
      await user.type(screen.getByLabelText(new RegExp(`^${blank}`)), '   ');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Send Invite' })).toBeDisabled());
    }
  );

  it('enables Send Invite when every field has text', async () => {
    const user = userEvent.setup();
    renderDialog();

    await fill(user, { 'First Name': 'Jane', 'Last Name': 'Doe', Phone: '2025550143', Email: 'jane@example.com' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Invite' })).toBeEnabled());
  });
});
