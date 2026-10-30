import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QuickPickSaveDialogs } from '../../src/features/visits/shared/components/QuickPickSaveDialogs';

const EXISTING = [
  { id: 'qp-1', name: 'Albuterol' },
  { id: 'qp-2', name: 'Flu shot' },
];

const renderDialogs = (initialName: string, onSave = vi.fn()): ReturnType<typeof vi.fn> => {
  const Harness = (): JSX.Element => {
    const [name, setName] = useState(initialName);
    return (
      <QuickPickSaveDialogs
        open
        name={name}
        onNameChange={setName}
        existingQuickPicks={EXISTING}
        saving={false}
        onClose={vi.fn()}
        onSave={onSave}
        entityLabel="medication"
      />
    );
  };
  render(<Harness />);
  return onSave;
};

describe('QuickPickSaveDialogs', () => {
  it('saves a new quick pick when the name does not match an existing one', async () => {
    const onSave = renderDialogs('');

    await userEvent.type(screen.getByRole('combobox', { name: 'Quick Pick Name' }), 'Ibuprofen');
    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith();
    expect(screen.queryByText('Update Existing Quick Pick?')).not.toBeInTheDocument();
  });

  it('lists existing quick picks in the name dropdown', async () => {
    renderDialogs('');

    await userEvent.click(screen.getByRole('combobox', { name: 'Quick Pick Name' }));

    expect(await screen.findByRole('option', { name: 'Albuterol' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Flu shot' })).toBeInTheDocument();
  });

  it('asks before replacing an existing quick pick and passes its id on Replace', async () => {
    const onSave = renderDialogs('');

    await userEvent.click(screen.getByRole('combobox', { name: 'Quick Pick Name' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Flu shot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));

    expect(await screen.findByText('Update Existing Quick Pick?')).toBeInTheDocument();
    expect(screen.getByText(/replace it with the current medication data/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onSave).toHaveBeenCalledWith('qp-2');
  });

  it('matches existing names case-insensitively and Back does not save', async () => {
    const onSave = renderDialogs('  albuterol ');

    await userEvent.click(screen.getByRole('button', { name: 'Save Quick Pick' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables saving when the name is blank', () => {
    renderDialogs('   ');

    expect(screen.getByRole('button', { name: 'Save Quick Pick' })).toBeDisabled();
  });
});
