import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, useState } from 'react';
import { Link, MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderJournal } from '../../src/features/journal/hooks/useProviderJournal';

const { mockGetProviderJournal } = vi.hoisted(() => ({ mockGetProviderJournal: vi.fn() }));
vi.mock('src/api/api', () => ({ getProviderJournal: mockGetProviderJournal }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

const Journal = (): ReactElement => {
  const { data } = useProviderJournal('prac-1');
  return <div>{data ? 'loaded' : 'loading'}</div>;
};

/** The Journal tab is a Link to /journal; the page can also unmount and mount again (Patients, then Journal). */
const App = (): ReactElement => {
  const [shown, setShown] = useState(true);
  return (
    <>
      <Link to="/journal">Journal</Link>
      <button onClick={() => setShown((s) => !s)}>toggle</button>
      {shown && <Journal />}
    </>
  );
};

describe('useProviderJournal', () => {
  beforeEach(() => {
    mockGetProviderJournal.mockReset();
    mockGetProviderJournal.mockResolvedValue({ kind: 'provider' });
  });

  it('reloads when the Journal tab is clicked and when the page mounts again', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/journal']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await screen.findByText('loaded');
    expect(mockGetProviderJournal).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText('Journal'));
    await waitFor(() => expect(mockGetProviderJournal).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByText('toggle'));
    await userEvent.click(screen.getByText('toggle'));
    await waitFor(() => expect(mockGetProviderJournal).toHaveBeenCalledTimes(3));
  });

  it('reloads when "Journal for" switches back to a journal already opened in this tab', async () => {
    const Picker = (): ReactElement => {
      const [id, setId] = useState('prac-a');
      const { data } = useProviderJournal(id);
      return (
        <>
          <button onClick={() => setId((current) => (current === 'prac-a' ? 'prac-b' : 'prac-a'))}>switch</button>
          <div>{data ? 'loaded' : 'loading'}</div>
        </>
      );
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/journal']}>
          <Picker />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await screen.findByText('loaded');
    await userEvent.click(screen.getByText('switch'));
    await waitFor(() => expect(mockGetProviderJournal).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByText('switch'));
    await waitFor(() => expect(mockGetProviderJournal).toHaveBeenCalledTimes(3));
    expect(mockGetProviderJournal.mock.calls[2][1]).toEqual(expect.objectContaining({ practitionerId: 'prac-a' }));
  });

  it('reloads when the user comes back to the journal browser tab (journal links open new tabs)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/journal']}>
          <Journal />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await screen.findByText('loaded');
    expect(mockGetProviderJournal).toHaveBeenCalledTimes(1);
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(mockGetProviderJournal).toHaveBeenCalledTimes(2));
    focusManager.setFocused(undefined);
  });
});
