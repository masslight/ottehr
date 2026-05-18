import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QuickPicksButton } from './QuickPicksButton';

describe('QuickPicksButton', () => {
  it('shows a loading item instead of an empty menu while picks are loading', async () => {
    const user = userEvent.setup();

    render(<QuickPicksButton quickPicks={[]} getLabel={(item) => item} onSelect={vi.fn()} loading />);

    await user.click(screen.getByRole('button', { name: 'Quick Picks' }));

    expect(screen.getByRole('menuitem', { name: 'Loading…' })).toBeInTheDocument();
  });
});
