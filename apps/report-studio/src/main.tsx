import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useStudio } from './state/store';
import { App } from './ui/App';

// For scripted checks (scripts/e2e.mjs): the store is reachable from the page.
(window as unknown as { __studio: typeof useStudio }).__studio = useStudio;

// The EHR's look: Ottehr primary / secondary, light theme, Rubik.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0F347C' },
    secondary: { main: '#2169F5' },
    background: { default: '#f4f6fa', paper: '#ffffff' },
    text: { primary: '#1a2233', secondary: '#5a6578' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Rubik, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 13.5,
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiButton: { defaultProps: { size: 'small' } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
