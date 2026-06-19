import { createTheme, ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen } from '@testing-library/react';
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
    cleanup();
    useCommandPaletteStore.setState({ isOpen: false });
  });

  it('renders a visible search affordance', () => {
    renderWithTheme();

    expect(screen.getByLabelText('Open search bar')).toBeTruthy();
  });

  it('opens the command palette when clicked', async () => {
    const user = userEvent.setup();

    renderWithTheme();
    await user.click(screen.getByLabelText('Open search bar'));

    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });
});
