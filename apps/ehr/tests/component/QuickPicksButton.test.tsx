import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickPicksButton } from '../../src/features/visits/shared/components/QuickPicksButton';

describe('Quick Picks Button', () => {
  it('does not render when there are no quick picks', () => {
    render(<QuickPicksButton quickPicks={[]} getLabel={(item) => item} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /quick picks/i })).not.toBeInTheDocument();
  });

  it('renders quick pick options and calls onSelect when one is chosen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <QuickPicksButton
        quickPicks={['Otitis media', 'Viral URI', 'Asthma exacerbation']}
        getLabel={(item) => item}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole('button', { name: /quick picks/i }));

    expect(screen.getByRole('menuitem', { name: 'Otitis media' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Viral URI' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Asthma exacerbation' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Viral URI' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('Viral URI');
    expect(screen.queryByRole('menuitem', { name: 'Otitis media' })).not.toBeInTheDocument();
  });
});
