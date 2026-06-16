import { ThemeProvider } from '@mui/material/styles';
import { render, RenderResult } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../src/themes/ottehr';

interface RenderOptions {
  // Mount under a route pattern so pages that read useParams resolve (e.g. '/patients/:id').
  path?: string;
  initialEntry?: string;
}

// Shared harness for billing component tests: wraps the page in the app MUI theme and a router.
export function renderWithProviders(ui: ReactElement, { path, initialEntry = '/' }: RenderOptions = {}): RenderResult {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {path ? (
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        ) : (
          ui
        )}
      </MemoryRouter>
    </ThemeProvider>
  );
}
