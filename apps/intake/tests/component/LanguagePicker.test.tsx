import { createTheme, ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { LanguagePicker } from '../../src/components/LanguagePicker';
import i18n from '../../src/lib/i18n';

const theme = createTheme();
const Wrapper: FC<{ children: ReactNode }> = ({ children }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>;

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('LanguagePicker', () => {
  test('renders an en/es toggle', () => {
    render(
      <Wrapper>
        <LanguagePicker />
      </Wrapper>
    );
    expect(screen.getByText('en')).toBeTruthy();
    expect(screen.getByText('es')).toBeTruthy();
  });

  test('clicking a language switches the active i18n language', async () => {
    render(
      <Wrapper>
        <LanguagePicker />
      </Wrapper>
    );
    expect(i18n.language.split('-')[0]).toBe('en');

    fireEvent.click(screen.getByText('es'));
    await waitFor(() => expect(i18n.language.split('-')[0]).toBe('es'));

    fireEvent.click(screen.getByText('en'));
    await waitFor(() => expect(i18n.language.split('-')[0]).toBe('en'));
  });
});
