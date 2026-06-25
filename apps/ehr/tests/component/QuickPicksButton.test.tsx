import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickPicksButton } from '../../src/features/visits/shared/components/QuickPicksButton';

const QUICK_PICKS = ['Otitis media', 'Viral URI', 'Asthma exacerbation'];

describe('Quick Picks Button', () => {
  it('does not render when there are no quick picks', () => {
    render(<QuickPicksButton quickPicks={[]} getLabel={(item) => item} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /quick picks/i })).not.toBeInTheDocument();
  });

  it('renders the button and shows a loading row while quick picks are loading', async () => {
    const user = userEvent.setup();

    render(<QuickPicksButton quickPicks={[]} getLabel={(item) => item} onSelect={vi.fn()} loading />);

    expect(screen.getByRole('button', { name: /quick picks/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /quick picks/i }));

    expect(screen.getByRole('menuitem', { name: 'Loading…' })).toBeInTheDocument();
  });

  it('renders when showAddOption is true even with no quick picks', () => {
    render(<QuickPicksButton quickPicks={[]} getLabel={(item) => item} onSelect={vi.fn()} showAddOption isAdmin />);

    expect(screen.getByRole('button', { name: /quick picks/i })).toBeInTheDocument();
  });

  it('renders quick pick options and calls onSelect when one is chosen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /quick picks/i }));

    expect(screen.getByRole('menuitem', { name: 'Otitis media' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Viral URI' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Asthma exacerbation' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Viral URI' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('Viral URI');
    expect(screen.queryByRole('menuitem', { name: 'Otitis media' })).not.toBeInTheDocument();
  });

  it('closes menu after selecting a quick pick', async () => {
    const user = userEvent.setup();

    render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /quick picks/i }));
    expect(screen.getByRole('menuitem', { name: 'Otitis media' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Otitis media' }));

    expect(screen.queryByRole('menuitem', { name: 'Otitis media' })).not.toBeInTheDocument();
  });

  describe('disabled prop', () => {
    it('renders a disabled button when disabled=true', () => {
      render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} disabled />);

      expect(screen.getByRole('button', { name: /quick picks/i })).toBeDisabled();
    });

    it('does not show any menu items since the disabled button cannot be opened', () => {
      render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} disabled />);

      // Menu items are not rendered because the menu has never been opened
      expect(screen.queryByRole('menuitem', { name: 'Otitis media' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Viral URI' })).not.toBeInTheDocument();
    });
  });

  describe('showAddOption with isAdmin', () => {
    it('shows "+ Add or Update Quick Pick" menu item when isAdmin=true', async () => {
      const user = userEvent.setup();
      const onAddOrUpdate = vi.fn();

      render(
        <QuickPicksButton
          quickPicks={QUICK_PICKS}
          getLabel={(item) => item}
          onSelect={vi.fn()}
          showAddOption
          isAdmin
          onAddOrUpdate={onAddOrUpdate}
        />
      );

      await user.click(screen.getByRole('button', { name: /quick picks/i }));

      expect(screen.getByRole('menuitem', { name: /Add or Update Quick Pick/i })).toBeInTheDocument();
    });

    it('calls onAddOrUpdate and closes menu when admin add option is clicked', async () => {
      const user = userEvent.setup();
      const onAddOrUpdate = vi.fn();

      render(
        <QuickPicksButton
          quickPicks={QUICK_PICKS}
          getLabel={(item) => item}
          onSelect={vi.fn()}
          showAddOption
          isAdmin
          onAddOrUpdate={onAddOrUpdate}
        />
      );

      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      await user.click(screen.getByRole('menuitem', { name: /Add or Update Quick Pick/i }));

      expect(onAddOrUpdate).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menuitem', { name: /Add or Update Quick Pick/i })).not.toBeInTheDocument();
    });

    it('shows disabled admin message when isAdmin=false', async () => {
      const user = userEvent.setup();

      render(
        <QuickPicksButton
          quickPicks={QUICK_PICKS}
          getLabel={(item) => item}
          onSelect={vi.fn()}
          showAddOption
          isAdmin={false}
        />
      );

      await user.click(screen.getByRole('button', { name: /quick picks/i }));

      expect(screen.getByText(/Add Or Update Quick Pick Requires Admin Role/i)).toBeInTheDocument();
      // The "+" admin action item should not be present — only the disabled info message
      expect(screen.queryByRole('menuitem', { name: /^\+ Add or Update Quick Pick$/i })).not.toBeInTheDocument();
    });
  });

  describe('searchable', () => {
    it('shows a search input when searchable=true and there are quick picks', async () => {
      const user = userEvent.setup();

      render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} searchable />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));

      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('does not show a search input when searchable=false', async () => {
      const user = userEvent.setup();

      render(
        <QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} searchable={false} />
      );

      await user.click(screen.getByRole('button', { name: /quick picks/i }));

      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    it('filters quick picks by search text', async () => {
      const user = userEvent.setup();

      render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} searchable />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      await user.type(screen.getByPlaceholderText('Search...'), 'viral');

      expect(screen.getByRole('menuitem', { name: 'Viral URI' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Otitis media' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Asthma exacerbation' })).not.toBeInTheDocument();
    });

    it('shows "No matches" when search yields no results', async () => {
      const user = userEvent.setup();

      render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} searchable />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      await user.type(screen.getByPlaceholderText('Search...'), 'xyznotfound');

      expect(screen.getByText('No matches')).toBeInTheDocument();
    });

    it('clears search text when menu is closed and reopened', async () => {
      const user = userEvent.setup();

      render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={vi.fn()} searchable />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      await user.type(screen.getByPlaceholderText('Search...'), 'viral');
      expect(screen.queryByRole('menuitem', { name: 'Otitis media' })).not.toBeInTheDocument();

      // Close menu by pressing Escape
      await user.keyboard('{Escape}');

      // Reopen menu
      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      expect(screen.getByRole('menuitem', { name: 'Otitis media' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Viral URI' })).toBeInTheDocument();
    });

    it('selects highlighted item with Enter key after ArrowDown navigation', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(<QuickPicksButton quickPicks={QUICK_PICKS} getLabel={(item) => item} onSelect={onSelect} searchable />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      const searchInput = screen.getByPlaceholderText('Search...');

      // Navigate down twice to highlight second item
      await user.type(searchInput, '{ArrowDown}');
      await user.type(searchInput, '{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });
});
