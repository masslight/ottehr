import { createTheme, ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCommandPaletteStore } from 'src/state/command-palette.store';
import { afterEach, describe, expect, it } from 'vitest';
import { CommandPaletteSearchButton } from './CommandPaletteSearchButton';

const renderWithTheme = (): void => {
  render(
    <ThemeProvider theme={createTheme()}>
      <CommandPaletteSearchButton />
    </ThemeProvider>
  );
};

describe('CommandPaletteSearchButton', () => {
  afterEach(() => {
    useCommandPaletteStore.setState({ isOpen: false });
  });

  it('renders a visible search field affordance', () => {
    renderWithTheme();

    expect(screen.getByLabelText('Open command palette')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  it('opens the command palette when clicked', async () => {
    const user = userEvent.setup();

    renderWithTheme();
    await user.click(screen.getByLabelText('Open command palette'));

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });
});
