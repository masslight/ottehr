import 'src/index.css';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { SnackbarProvider } from 'notistack';
import { Component, ReactElement, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CustomThemeProvider } from 'src/CustomThemeProvider';
import { installFetchMock } from './fetch-mock';
import type { DialogStory } from './story';

declare global {
  interface Window {
    __story: { status: 'loading' | 'ready' | 'error'; error?: string; meta?: Record<string, unknown> };
  }
}

const loaders = import.meta.glob<{ default: DialogStory }>('../stories/**/*.story.tsx');
const ids = Object.keys(loaders)
  .map((p) => p.replace('../stories/', '').replace('.story.tsx', ''))
  .sort();

const fail = (error: unknown): void => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  console.error('[gallery] story failed', error);
  window.__story = { ...window.__story, status: 'error', error: message };
};

class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }
  componentDidCatch(error: Error): void {
    fail(error);
  }
  render(): ReactNode {
    return this.state.error ? (
      <pre style={{ color: '#b00020', padding: 24, whiteSpace: 'pre-wrap' }}>{String(this.state.error.stack)}</pre>
    ) : (
      this.props.children
    );
  }
}

function Index(): ReactElement {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h2>Dialog gallery — {ids.length} stories</h2>
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <a href={`?story=${encodeURIComponent(id)}`}>{id}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function main(): Promise<void> {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  const id = new URLSearchParams(window.location.search).get('story');
  window.__story = { status: 'loading' };
  if (new URLSearchParams(window.location.search).has('list')) {
    document.body.innerHTML = `<pre id="ids">${JSON.stringify(ids)}</pre>`;
    return;
  }
  if (!id) {
    root.render(<Index />);
    return;
  }
  const loader = loaders[`../stories/${id}.story.tsx`];
  if (!loader) {
    fail(new Error(`No story "${id}"`));
    return;
  }
  try {
    // Mocks must be known before the story module (and everything it imports) evaluates.
    installFetchMock([]);
    const story = (await loader()).default;
    installFetchMock(story.mocks ?? []);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
    });
    await story.setup?.({ queryClient });
    const { render: _render, play: _play, setup: _setup, mocks: _mocks, ...meta } = story;
    window.__story.meta = { id, ...meta };
    root.render(
      <Boundary>
        <QueryClientProvider client={queryClient}>
          <CustomThemeProvider>
            <CssBaseline />
            <SnackbarProvider maxSnack={5} autoHideDuration={6000}>
              <MemoryRouter initialEntries={[story.route ?? '/']}>
                <Routes>
                  <Route path={story.routePath ?? '*'} element={story.render()} />
                </Routes>
              </MemoryRouter>
            </SnackbarProvider>
          </CustomThemeProvider>
        </QueryClientProvider>
      </Boundary>
    );
    await new Promise((r) => setTimeout(r, 50));
    if (story.play) {
      await story.play({ user: userEvent.setup({ delay: null }), screen, waitFor });
    }
    if (window.__story.status !== 'error') window.__story.status = 'ready';
  } catch (error) {
    fail(error);
  }
}

window.addEventListener('unhandledrejection', (e) => console.warn('[gallery] unhandled rejection', e.reason));
void main();
