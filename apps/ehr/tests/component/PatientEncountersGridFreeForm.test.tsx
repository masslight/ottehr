import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DeleteFreeFormEncounterOutput } from 'utils/lib/types/api/free-form-encounter.types';
import {
  AppointmentHistoryRow,
  FollowUpVisitHistoryRow,
  FreeFormEncounterHistoryRow,
  PatientVisitListResponse,
} from 'utils/lib/types/api/patient-visit-history.types';
import { ServiceMode } from 'utils/lib/types/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientEncountersGrid } from '../../src/components/PatientEncountersGrid';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { useDeletedFreeFormEncountersStore } from '../../src/state/deleted-free-form-encounters.store';
import { visitTypeToInPersonLabel } from '../../src/types/types';

const PATIENT_A = '11111111-1111-4111-8111-111111111111';
const PATIENT_B = '22222222-2222-4222-8222-222222222222';
const PLACEHOLDER = 'Enter free form note here...';
const NOW_ISO = '2026-10-26T12:00:00.000Z';

let routePatientId = PATIENT_A;
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ id: routePatientId }), useNavigate: () => vi.fn() };
});

const saveMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('../../src/api/api', () => ({
  saveFreeFormEncounter: (...args: unknown[]) => saveMock(...args),
  deleteFreeFormEncounter: (...args: unknown[]) => deleteMock(...args),
  listServiceCategories: () => Promise.resolve({ serviceCategories: [] }),
}));

const executeMock = vi.fn();
const oystehrZambda = { zambda: { execute: (...args: unknown[]) => executeMock(...args) } };
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda }) }));

const enqueueSnackbarMock = vi.fn();
vi.mock('notistack', () => ({ enqueueSnackbar: (...args: unknown[]) => enqueueSnackbarMock(...args) }));

const visit = (id: string, dateTime: string, office = 'NY Office'): AppointmentHistoryRow =>
  ({
    appointmentId: id,
    type: 'walk-in',
    length: 10,
    serviceMode: ServiceMode['in-person'],
    visitReason: 'Cough',
    office,
    dateTime,
    encounterId: `enc-${id}`,
    sendInvoiceTask: undefined,
    provider: undefined,
    status: 'completed',
    followUps: [],
  }) as AppointmentHistoryRow;

const olderVisits = (count: number): AppointmentHistoryRow[] =>
  Array.from({ length: count }, (_, index) =>
    visit(`visit-${String(index).padStart(2, '0')}`, `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00-05:00`)
  );

const freeForm = (
  encounterId: string,
  note: string,
  overrides: Partial<FreeFormEncounterHistoryRow> = {}
): FreeFormEncounterHistoryRow => ({
  encounterId,
  dateTime: NOW_ISO,
  note,
  lastUpdated: '2026-10-26T12:00:01.000Z',
  ...overrides,
});

const historyOf = (
  visits: AppointmentHistoryRow[],
  freeFormEncounters: FreeFormEncounterHistoryRow[] = []
): PatientVisitListResponse => ({
  visits,
  freeFormEncounters,
  metadata: { totalCount: visits.length, sortDirection: 'desc' },
});

type HistoryStep = PatientVisitListResponse | Error | Promise<PatientVisitListResponse>;
const historyQueues = new Map<string, HistoryStep[]>();
const historyCalls: Array<{ patientId: string }> = [];

const setHistory = (patientId: string, ...steps: HistoryStep[]): void => {
  historyQueues.set(patientId, steps);
};

const deferred = <T,>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createQueryClient = (): QueryClient => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderGrid = (
  patientId = PATIENT_A,
  queryClient = createQueryClient()
): {
  queryClient: QueryClient;
  switchPatient: (id: string) => void;
  showPatient: (routeId: string, loadedPatientId: string) => void;
} => {
  routePatientId = patientId;
  const ui = (id: string): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PatientEncountersGrid patient={{ resourceType: 'Patient', id }} totalCount={7} latestVisitDate={null} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(ui(patientId));
  const showPatient = (routeId: string, loadedPatientId: string): void => {
    routePatientId = routeId;
    result.rerender(ui(loadedPatientId));
  };
  return {
    queryClient,
    switchPatient: (id: string) => showPatient(id, id),
    showPatient,
  };
};

const addButton = (): HTMLElement => screen.getByTestId(dataTestIds.patientRecordPage.addFreeFormButton);
const noteInputs = (): HTMLTextAreaElement[] =>
  screen.queryAllByTestId(dataTestIds.patientRecordPage.freeFormNoteInput) as HTMLTextAreaElement[];
const noteValues = (): string[] => noteInputs().map((input) => input.value);
const draftInput = (): HTMLTextAreaElement => screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;
const countOf = (text: string): number => noteValues().filter((value) => value === text).length;
const paginationText = (): string => screen.getByText(/\d+–\d+ of \d+/).textContent ?? '';

const waitForVisits = async (): Promise<void> => {
  await screen.findAllByText('NY Office');
};

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const chooseType = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: /^Type/ }));
  await user.click(await screen.findByRole('option', { name: label }));
};

const chooseVisitPeriod = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: /^Visit Period/ }));
  await user.click(await screen.findByRole('option', { name: label }));
};

const sortAscending = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const header = screen.getByText('Date & Time').closest('th') as HTMLElement;
  await user.click(within(header).getByRole('button'));
};

const rowOf = (input: HTMLElement): HTMLElement => input.closest('tr') as HTMLElement;
const noteInput = (text: string): HTMLTextAreaElement => noteInputs().find((input) => input.value === text)!;
const deleteButtonOf = (input: HTMLElement): HTMLElement | null =>
  within(rowOf(input)).queryByTestId(dataTestIds.patientRecordPage.freeFormDeleteButton);
const deleteDialog = (): HTMLElement | null => screen.queryByRole('dialog');
const confirmDelete = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(within(deleteDialog()!).getByRole('button', { name: 'Delete' }));
};
const keepNote = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(within(deleteDialog()!).getByRole('button', { name: 'Keep' }));
  await waitFor(() => expect(deleteDialog()).not.toBeInTheDocument());
};
const RECONCILE_WARNING = 'Note saved; it may take a moment to appear after a reload';

describe('PatientEncountersGrid free-form encounters', () => {
  beforeEach(() => {
    routePatientId = PATIENT_A;
    historyQueues.clear();
    historyCalls.length = 0;
    saveMock.mockReset();
    deleteMock.mockReset();
    useDeletedFreeFormEncountersStore.setState({ deletedIdsByPatient: {} });
    enqueueSnackbarMock.mockReset();
    executeMock.mockReset();
    executeMock.mockImplementation(async (params: { id: string; patientId: string }) => {
      if (params.id !== 'get-patient-visit-history') throw new Error(`Unexpected zambda ${params.id}`);
      historyCalls.push({ patientId: params.patientId });
      const queue = historyQueues.get(params.patientId) ?? [historyOf([])];
      const step = queue.length > 1 ? queue.shift()! : queue[0];
      if (step instanceof Error) throw step;
      return { output: await step };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('drafts', () => {
    it('adds a focused draft with the placeholder and disables the button', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      renderGrid();
      await waitForVisits();

      await user.click(addButton());

      expect(draftInput()).toHaveFocus();
      expect(addButton()).toBeDisabled();
    });

    it('resets the Type, Status and Service Category filters and the page when a draft is added', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(25)));
      renderGrid();
      await waitForVisits();

      await chooseType(user, visitTypeToInPersonLabel['walk-in']);
      await user.click(screen.getByRole('button', { name: 'Go to next page' }));
      expect(paginationText()).toBe('21–25 of 25');

      await user.click(addButton());

      expect(screen.getByRole('combobox', { name: /^Type/ })).toHaveTextContent('All');
      expect(screen.getByRole('combobox', { name: /^Visit Status/ })).toHaveTextContent('All');
      expect(screen.getByRole('combobox', { name: /^Service Category/ })).toHaveTextContent('All');
      await waitFor(() => expect(paginationText()).toBe('1–20 of 25'));
    });

    it('discards a fresh draft on Escape without saving', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Never mind');
      await user.keyboard('{Escape}');

      expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();
      expect(addButton()).toBeEnabled();
      expect(saveMock).not.toHaveBeenCalled();
    });
  });

  describe('saving a draft', () => {
    it('creates the note on blur and swaps the draft for the saved row', async () => {
      const user = userEvent.setup();
      const saved = freeForm('note-1', 'Called about the dosage');
      setHistory(PATIENT_A, historyOf(olderVisits(1)), historyOf(olderVisits(1), [saved]));
      saveMock.mockResolvedValue(saved);
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), '  Called about the dosage ');
      await user.click(document.body);

      expect(saveMock).toHaveBeenCalledWith(oystehrZambda, {
        patientId: PATIENT_A,
        encounterId: undefined,
        note: 'Called about the dosage',
      });
      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(countOf('Called about the dosage')).toBe(1);
    });

    it('does not start a second create when the draft is blurred again while the first is in flight', async () => {
      const user = userEvent.setup();
      const pending = deferred<FreeFormEncounterHistoryRow>();
      const saved = freeForm('note-1', 'Only once');
      setHistory(PATIENT_A, historyOf(olderVisits(1)), historyOf(olderVisits(1), [saved]));
      saveMock.mockReturnValue(pending.promise);
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Only once');
      await user.click(document.body);
      await user.click(draftInput());
      await user.click(document.body);
      await act(async () => pending.resolve(saved));

      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(countOf('Only once')).toBe(1);
    });

    it('keeps the text and the draft when the save fails, and retries the create on the next blur', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      saveMock.mockRejectedValueOnce(new Error('boom')).mockReturnValueOnce(new Promise(() => undefined));
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Lab results question');
      await user.click(document.body);

      await waitFor(() =>
        expect(enqueueSnackbarMock).toHaveBeenCalledWith("Couldn't save the note. Please try again.", {
          variant: 'error',
        })
      );
      expect(draftInput().value).toBe('Lab results question');
      expect(addButton()).toBeDisabled();

      await user.click(draftInput());
      await user.click(document.body);
      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock.mock.calls[1][1]).toMatchObject({ encounterId: undefined, note: 'Lab results question' });
    });

    it('moves to the page holding the new row when sorted oldest first', async () => {
      const user = userEvent.setup();
      const saved = freeForm('note-1', 'Newest note');
      setHistory(PATIENT_A, historyOf(olderVisits(25)), historyOf(olderVisits(25), [saved]));
      saveMock.mockResolvedValue(saved);
      renderGrid();
      await waitForVisits();
      await sortAscending(user);

      await user.click(addButton());
      await user.type(draftInput(), 'Newest note');
      await user.click(document.body);

      await waitFor(() => expect(paginationText()).toBe('21–26 of 26'));
      expect(countOf('Newest note')).toBe(1);
    });
  });

  describe('reconciliation', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('keeps one pinned draft while the search is stale, then shows the saved row once it arrives', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const saved = freeForm('note-1', 'Stale search note');
      const before = historyOf(olderVisits(1));
      setHistory(PATIENT_A, before, before, historyOf(olderVisits(1), [saved]));
      saveMock.mockResolvedValue(saved);
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Stale search note');
      await user.click(document.body);

      await waitFor(() => expect(historyCalls).toHaveLength(2));
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
      expect(addButton()).toBeDisabled();
      expect(countOf('Stale search note')).toBe(1);

      await advance(1000);

      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(countOf('Stale search note')).toBe(1);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('keeps a saved draft and its unsaved text when saving more text fails', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const saved = freeForm('note-1', 'First words');
      const updated = freeForm('note-1', 'First words and more', { lastUpdated: '2026-10-26T12:00:05.000Z' });
      const before = historyOf(olderVisits(1));
      setHistory(PATIENT_A, before, before, historyOf(olderVisits(1), [saved]));
      saveMock.mockResolvedValueOnce(saved).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(updated);
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'First words');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      await user.click(draftInput());
      await user.type(draftInput(), ' and more');
      await advance(1000);
      await waitFor(() => expect(historyCalls).toHaveLength(3));
      await user.click(document.body);

      await waitFor(() =>
        expect(enqueueSnackbarMock).toHaveBeenCalledWith("Couldn't save the note. Please try again.", {
          variant: 'error',
        })
      );
      expect(addButton()).toBeDisabled();
      expect(countOf('First words and more')).toBe(1);

      await user.click(draftInput());
      await user.click(document.body);

      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(saveMock).toHaveBeenCalledTimes(3);
      expect(saveMock.mock.calls[2][1]).toEqual({
        patientId: PATIENT_A,
        encounterId: 'note-1',
        note: 'First words and more',
      });
      expect(countOf('First words and more')).toBe(1);
    });

    it('waits for the user to stop typing in the draft before releasing it', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const saved = freeForm('note-1', 'First words');
      const updated = freeForm('note-1', 'First words and more', { lastUpdated: '2026-10-26T12:00:05.000Z' });
      const before = historyOf(olderVisits(1));
      setHistory(PATIENT_A, before, before, historyOf(olderVisits(1), [saved]), historyOf(olderVisits(1), [updated]));
      saveMock.mockResolvedValueOnce(saved).mockResolvedValueOnce(updated);
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'First words');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));

      await user.click(draftInput());
      await user.type(draftInput(), ' and more');
      await advance(1000);
      await waitFor(() => expect(historyCalls).toHaveLength(3));

      expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveFocus();
      expect(countOf('First words and more')).toBe(1);

      await user.click(document.body);

      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(saveMock.mock.calls[1][1]).toEqual({
        patientId: PATIENT_A,
        encounterId: 'note-1',
        note: 'First words and more',
      });
      expect(countOf('First words and more')).toBe(1);
    });

    it('falls back to the locally saved row when the search never catches up', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const saved = freeForm('note-1', 'Never indexed');
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      saveMock
        .mockResolvedValueOnce(saved)
        .mockResolvedValueOnce({ ...saved, note: 'Never indexed, edited', lastUpdated: '2026-10-26T12:01:00.000Z' });
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Never indexed');
      await user.click(document.body);
      await advance(15_000);

      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(countOf('Never indexed')).toBe(1);
      expect(enqueueSnackbarMock).toHaveBeenCalledWith('Note saved; it may take a moment to appear after a reload', {
        variant: 'warning',
      });

      const row = noteInputs().find((input) => input.value === 'Never indexed')!;
      await user.click(row);
      await user.type(row, ', edited');
      await user.click(document.body);

      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock.mock.calls[0][1]).toMatchObject({ encounterId: undefined });
      expect(saveMock.mock.calls[1][1]).toMatchObject({ encounterId: 'note-1', note: 'Never indexed, edited' });
    });

    it("reports a refresh failure when the last attempt couldn't load the list", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      setHistory(PATIENT_A, historyOf(olderVisits(1)), new Error('offline'));
      saveMock.mockResolvedValue(freeForm('note-1', 'Saved while offline'));
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Saved while offline');
      await user.click(document.body);
      await advance(15_000);

      await waitFor(() =>
        expect(enqueueSnackbarMock).toHaveBeenCalledWith("Note saved, but the visit list couldn't refresh", {
          variant: 'warning',
        })
      );
      expect(addButton()).toBeEnabled();
      expect(countOf('Saved while offline')).toBe(1);
    });

    it('lands on the page holding the local row when retries run out, sorted oldest first', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      setHistory(PATIENT_A, historyOf(olderVisits(25)));
      saveMock.mockResolvedValue(freeForm('note-1', 'Late note'));
      renderGrid();
      await waitForVisits();
      await sortAscending(user);

      await user.click(addButton());
      await user.type(draftInput(), 'Late note');
      await user.click(document.body);
      await advance(15_000);

      await waitFor(() => expect(paginationText()).toBe('21–26 of 26'));
      expect(countOf('Late note')).toBe(1);
    });

    it('keeps the page when a filter chosen after the create hides the row', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      setHistory(PATIENT_A, historyOf(olderVisits(25)));
      saveMock.mockResolvedValue(freeForm('note-1', 'Hidden by a filter'));
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Hidden by a filter');
      await user.click(document.body);
      await chooseType(user, visitTypeToInPersonLabel['walk-in']);
      await advance(15_000);

      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(paginationText()).toBe('1–20 of 25');
      expect(countOf('Hidden by a filter')).toBe(0);
    });
  });

  describe('switching patients', () => {
    it("never fetches, caches or shows the previous patient's history under the next patient's route", async () => {
      const historyOfA = historyOf(
        [visit('a-visit', '2026-03-01T10:00:00-05:00', 'Office of A')],
        [freeForm('a-note', 'Note for A')]
      );
      const historyOfB = historyOf(
        [visit('b-visit', '2026-04-01T10:00:00-05:00', 'Office of B')],
        [freeForm('b-note', 'Note for B')]
      );
      const keyOfB = ['get-patient-visit-history', { patientId: PATIENT_B, status: 'all', type: 'all', period: 0 }];
      setHistory(PATIENT_A, historyOfA);
      setHistory(PATIENT_B, historyOfB);
      const { queryClient, showPatient } = renderGrid();
      await screen.findByText('Office of A');
      expect(countOf('Note for A')).toBe(1);
      const callsForA = historyCalls.filter((call) => call.patientId === PATIENT_A).length;

      showPatient(PATIENT_B, PATIENT_A);

      expect(screen.queryByText('Office of A')).not.toBeInTheDocument();
      expect(countOf('Note for A')).toBe(0);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(addButton()).toBeDisabled();
      await act(async () => undefined);
      expect(historyCalls.filter((call) => call.patientId === PATIENT_A)).toHaveLength(callsForA);
      expect(queryClient.getQueryData(keyOfB)).toBeUndefined();

      showPatient(PATIENT_B, PATIENT_B);

      await screen.findByText('Office of B');
      expect(countOf('Note for B')).toBe(1);
      expect(screen.queryByText('Office of A')).not.toBeInTheDocument();
      expect(countOf('Note for A')).toBe(0);
      expect(queryClient.getQueryData(keyOfB)).toEqual(historyOfB);
      expect(addButton()).toBeEnabled();
    });

    it('ignores a create that finishes after switching to another patient', async () => {
      const user = userEvent.setup();
      const pending = deferred<FreeFormEncounterHistoryRow>();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      setHistory(PATIENT_B, historyOf([visit('b-visit', '2026-02-01T10:00:00-05:00')]));
      saveMock.mockReturnValue(pending.promise);
      const { switchPatient } = renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Note for patient A');
      await user.click(document.body);
      switchPatient(PATIENT_B);
      await waitFor(() => expect(historyCalls.some((call) => call.patientId === PATIENT_B)).toBe(true));
      const callsForA = historyCalls.filter((call) => call.patientId === PATIENT_A).length;

      await act(async () => pending.resolve(freeForm('note-a', 'Note for patient A')));

      expect(countOf('Note for patient A')).toBe(0);
      expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();
      expect(addButton()).toBeEnabled();
      expect(historyCalls.filter((call) => call.patientId === PATIENT_A)).toHaveLength(callsForA);
    });

    it('does not attach a late create to a new draft after switching away and back', async () => {
      const user = userEvent.setup();
      const pending = deferred<FreeFormEncounterHistoryRow>();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      setHistory(PATIENT_B, historyOf([]));
      saveMock.mockReturnValueOnce(pending.promise).mockReturnValueOnce(new Promise(() => undefined));
      const { switchPatient } = renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'First visit to A');
      await user.click(document.body);
      switchPatient(PATIENT_B);
      switchPatient(PATIENT_A);
      await waitForVisits();
      await user.click(addButton());
      await act(async () => pending.resolve(freeForm('note-old', 'First visit to A')));

      await user.type(draftInput(), 'Second visit to A');
      await user.click(document.body);

      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock.mock.calls[1][1]).toEqual({
        patientId: PATIENT_A,
        encounterId: undefined,
        note: 'Second visit to A',
      });
    });

    it('still reports a create that fails after switching patients', async () => {
      const user = userEvent.setup();
      const pending = deferred<FreeFormEncounterHistoryRow>();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      setHistory(PATIENT_B, historyOf([]));
      saveMock.mockReturnValue(pending.promise);
      const { switchPatient } = renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Lost note');
      await user.click(document.body);
      switchPatient(PATIENT_B);
      await act(async () => pending.reject(new Error('boom')));

      expect(enqueueSnackbarMock).toHaveBeenCalledWith("Couldn't save the free-form note for the previous patient.", {
        variant: 'error',
      });
    });

    it("never writes a patient's note into another patient's or another filter's cached history", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const queryClient = createQueryClient();
      const patientBKey = [
        'get-patient-visit-history',
        { patientId: PATIENT_B, status: 'all', type: 'all', period: 0 },
      ];
      const patientAFilteredKey = [
        'get-patient-visit-history',
        { patientId: PATIENT_A, status: 'all', type: 'walk-in|in-person', period: 0 },
      ];
      queryClient.setQueryData(patientBKey, historyOf([visit('b-visit', '2026-02-01T10:00:00-05:00')]));
      queryClient.setQueryData(patientAFilteredKey, historyOf(olderVisits(1)));
      const patientBBefore = structuredClone(queryClient.getQueryData(patientBKey));
      const patientAFilteredBefore = structuredClone(queryClient.getQueryData(patientAFilteredKey));
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      setHistory(PATIENT_B, historyOf([visit('b-visit', '2026-02-01T10:00:00-05:00')]));
      saveMock.mockResolvedValue(freeForm('note-a', 'Only for A'));
      const { switchPatient } = renderGrid(PATIENT_A, queryClient);
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Only for A');
      await user.click(document.body);
      await advance(15_000);
      await waitFor(() => expect(addButton()).toBeEnabled());
      expect(countOf('Only for A')).toBe(1);

      expect(queryClient.getQueryData(patientBKey)).toEqual(patientBBefore);
      expect(queryClient.getQueryData(patientAFilteredKey)).toEqual(patientAFilteredBefore);

      await chooseType(user, visitTypeToInPersonLabel['walk-in']);
      expect(countOf('Only for A')).toBe(0);

      switchPatient(PATIENT_B);
      await waitFor(() => expect(historyCalls.some((call) => call.patientId === PATIENT_B)).toBe(true));
      expect(countOf('Only for A')).toBe(0);
    });
  });

  describe('editing an existing note', () => {
    it('saves a second edit made while the refresh after the first save is still loading', async () => {
      const user = userEvent.setup();
      const original = freeForm('note-1', 'First', { lastUpdated: '2026-10-26T12:00:01.000Z' });
      const firstSave = { ...original, note: 'First edit', lastUpdated: '2026-10-26T12:05:00.000Z' };
      const secondSave = { ...original, note: 'First edit, second edit', lastUpdated: '2026-10-26T12:06:00.000Z' };
      const slowRefresh = deferred<PatientVisitListResponse>();
      setHistory(
        PATIENT_A,
        historyOf(olderVisits(1), [original]),
        slowRefresh.promise,
        historyOf(olderVisits(1), [secondSave])
      );
      saveMock.mockResolvedValueOnce(firstSave).mockResolvedValueOnce(secondSave);
      renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'First')!;

      await user.clear(input);
      await user.type(input, 'First edit');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      await user.click(input);
      await user.type(input, ', second edit');
      await user.click(document.body);

      await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));
      expect(saveMock.mock.calls[1][1]).toEqual({
        patientId: PATIENT_A,
        encounterId: 'note-1',
        note: 'First edit, second edit',
      });
      slowRefresh.resolve(historyOf(olderVisits(1), [firstSave]));
      await waitFor(() => expect(input.value).toBe('First edit, second edit'));
    });

    it("hides an edited note from before the Visit Period while the search hasn't caught up", async () => {
      const user = userEvent.setup();
      const oldNote = freeForm('old-note', 'Old note', {
        dateTime: '2025-01-15T12:00:00.000Z',
        lastUpdated: '2025-01-15T12:00:01.000Z',
      });
      const edited = { ...oldNote, note: 'Old note, edited', lastUpdated: '2026-10-26T12:05:00.000Z' };
      setHistory(
        PATIENT_A,
        historyOf(olderVisits(1), [oldNote]),
        historyOf(olderVisits(1), [oldNote]),
        historyOf(olderVisits(1))
      );
      saveMock.mockResolvedValue(edited);
      renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Old note')!;

      await user.click(input);
      await user.type(input, ', edited');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      expect(countOf('Old note, edited')).toBe(1);

      await chooseVisitPeriod(user, 'Last month');

      await waitFor(() => expect(historyCalls).toHaveLength(3));
      expect(countOf('Old note, edited')).toBe(0);
    });

    it('keeps unsaved text when the server note changes while its save is failing', async () => {
      const user = userEvent.setup();
      const versionOne = freeForm('note-1', 'Server v1', { lastUpdated: '2026-10-26T12:00:01.000Z' });
      const versionTwo = { ...versionOne, note: 'Server v2', lastUpdated: '2026-10-26T12:10:00.000Z' };
      const failingSave = deferred<FreeFormEncounterHistoryRow>();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [versionOne]), historyOf(olderVisits(1), [versionTwo]));
      saveMock.mockReturnValueOnce(failingSave.promise).mockReturnValueOnce(new Promise(() => undefined));
      const { queryClient } = renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Server v1')!;

      await user.clear(input);
      await user.type(input, 'My edit');
      await user.click(document.body);
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['get-patient-visit-history'] });
      });
      expect(input.value).toBe('My edit');
      await act(async () => failingSave.reject(new Error('boom')));

      expect(input.value).toBe('My edit');
      await user.click(input);
      await user.click(document.body);
      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock.mock.calls[1][1]).toEqual({ patientId: PATIENT_A, encounterId: 'note-1', note: 'My edit' });
    });

    it('keeps the saved text while the refresh after the save is pending and when it returns older data', async () => {
      const user = userEvent.setup();
      const original = freeForm('note-1', 'Old text', { lastUpdated: '2026-10-26T12:00:01.000Z' });
      const saved = { ...original, note: 'New text', lastUpdated: '2026-10-26T12:05:00.000Z' };
      const pendingRefresh = deferred<PatientVisitListResponse>();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [original]), pendingRefresh.promise);
      saveMock.mockResolvedValue(saved);
      renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Old text')!;

      await user.clear(input);
      await user.type(input, 'New text');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      await waitFor(() => expect(input).not.toHaveAttribute('readonly'));

      expect(input.value).toBe('New text');
      await act(async () => pendingRefresh.resolve(historyOf(olderVisits(1), [original])));
      expect(input.value).toBe('New text');
    });

    it('restores the newest server note on Escape after a failed save', async () => {
      const user = userEvent.setup();
      const versionOne = freeForm('note-1', 'Server v1', { lastUpdated: '2026-10-26T12:00:01.000Z' });
      const versionTwo = { ...versionOne, note: 'Server v2', lastUpdated: '2026-10-26T12:10:00.000Z' };
      setHistory(PATIENT_A, historyOf(olderVisits(1), [versionOne]), historyOf(olderVisits(1), [versionTwo]));
      saveMock.mockRejectedValue(new Error('boom'));
      const { queryClient } = renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Server v1')!;

      await user.clear(input);
      await user.type(input, 'My edit');
      await user.click(document.body);
      await waitFor(() =>
        expect(enqueueSnackbarMock).toHaveBeenCalledWith("Couldn't save the note. Please try again.", {
          variant: 'error',
        })
      );
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['get-patient-visit-history'] });
      });
      expect(input.value).toBe('My edit');

      await user.click(input);
      await user.keyboard('{Escape}');

      expect(input.value).toBe('Server v2');
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('reverts on Escape without saving', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-1', 'Original text')]));
      renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Original text')!;

      await user.click(input);
      await user.type(input, ' plus an unsaved edit');
      await user.keyboard('{Escape}');

      expect(input.value).toBe('Original text');
      expect(input).not.toHaveFocus();
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('does not save a note with surrounding whitespace when blurred without edits, but saves a real edit', async () => {
      const user = userEvent.setup();
      const legacy = freeForm('legacy-1', 'Asked about X-ray \n');
      const edited = { ...legacy, note: 'Asked about X-ray, called back', lastUpdated: '2026-10-26T12:05:00.000Z' };
      setHistory(PATIENT_A, historyOf(olderVisits(1), [legacy]));
      saveMock.mockResolvedValue(edited);
      renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Asked about X-ray \n')!;

      await user.click(input);
      await user.click(document.body);

      expect(saveMock).not.toHaveBeenCalled();
      expect(input.value).toBe('Asked about X-ray \n');

      await user.clear(input);
      await user.type(input, 'Asked about X-ray, called back');
      await user.click(document.body);

      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(saveMock.mock.calls[0][1]).toEqual({
        patientId: PATIENT_A,
        encounterId: 'legacy-1',
        note: 'Asked about X-ray, called back',
      });
      await waitFor(() => expect(input.value).toBe('Asked about X-ray, called back'));
    });

    it('still saves the next edit after Escape was pressed while a save was in flight', async () => {
      const user = userEvent.setup();
      const pending = deferred<FreeFormEncounterHistoryRow>();
      const original = freeForm('note-1', 'Original');
      setHistory(PATIENT_A, historyOf(olderVisits(1), [original]));
      saveMock.mockReturnValueOnce(pending.promise).mockReturnValueOnce(new Promise(() => undefined));
      renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Original')!;

      await user.click(input);
      await user.type(input, ' first');
      await user.click(document.body);
      await user.click(input);
      await user.keyboard('{Escape}');
      await act(async () =>
        pending.resolve({ ...original, note: 'Original first', lastUpdated: '2026-10-26T12:05:00.000Z' })
      );

      await user.click(input);
      await user.type(input, ' second');
      await user.click(document.body);

      expect(saveMock).toHaveBeenCalledTimes(2);
      expect(saveMock.mock.calls[1][1]).toEqual({
        patientId: PATIENT_A,
        encounterId: 'note-1',
        note: 'Original first second',
      });
    });

    it('does not warn when a newer fetch supersedes the refresh that follows an edit', async () => {
      const user = userEvent.setup();
      const original = freeForm('note-1', 'Before', { lastUpdated: '2026-10-26T12:00:01.000Z' });
      const saved = { ...original, note: 'After', lastUpdated: '2026-10-26T12:05:00.000Z' };
      const supersededRefresh = deferred<PatientVisitListResponse>();
      setHistory(
        PATIENT_A,
        historyOf(olderVisits(1), [original]),
        supersededRefresh.promise,
        historyOf(olderVisits(1), [saved])
      );
      saveMock.mockResolvedValue(saved);
      const { queryClient } = renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Before')!;

      await user.clear(input);
      await user.type(input, 'After');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: ['get-patient-visit-history'] });
      });
      supersededRefresh.resolve(historyOf(olderVisits(1), [original]));

      await waitFor(() => expect(historyCalls).toHaveLength(3));
      expect(input.value).toBe('After');
      expect(enqueueSnackbarMock).not.toHaveBeenCalled();
    });

    it('shows newer server text after a blur without edits', async () => {
      const user = userEvent.setup();
      const versionOne = freeForm('note-1', 'Version one', { lastUpdated: '2026-10-26T12:00:01.000Z' });
      const versionTwo = { ...versionOne, note: 'Version two', lastUpdated: '2026-10-26T12:10:00.000Z' };
      setHistory(PATIENT_A, historyOf(olderVisits(1), [versionOne]), historyOf(olderVisits(1), [versionTwo]));
      const { queryClient } = renderGrid();
      await waitForVisits();
      const input = noteInputs().find((element) => element.value === 'Version one')!;

      await user.click(input);
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['get-patient-visit-history'] });
      });
      expect(input.value).toBe('Version one');

      await user.click(document.body);

      expect(input.value).toBe('Version two');
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('keeps the saved text over a stale refetch until the server catches up', async () => {
      const user = userEvent.setup();
      const original = freeForm('note-1', 'Old text', { lastUpdated: '2026-10-26T12:00:01.000Z' });
      const saved = { ...original, note: 'New text', lastUpdated: '2026-10-26T12:05:00.000Z' };
      const newerElsewhere = { ...original, note: 'Edited elsewhere', lastUpdated: '2026-10-26T12:10:00.000Z' };
      setHistory(
        PATIENT_A,
        historyOf(olderVisits(25), [original]),
        historyOf(olderVisits(25), [original]),
        historyOf(olderVisits(25), [newerElsewhere])
      );
      saveMock.mockResolvedValue(saved);
      const { queryClient } = renderGrid();
      await waitForVisits();

      const input = noteInputs().find((element) => element.value === 'Old text')!;
      await user.clear(input);
      await user.type(input, 'New text');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));

      expect(noteValues()).toContain('New text');
      expect(noteValues()).not.toContain('Old text');

      await user.click(screen.getByRole('button', { name: 'Go to next page' }));
      await user.click(screen.getByRole('button', { name: 'Go to previous page' }));
      expect(noteValues()).toContain('New text');

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['get-patient-visit-history'] });
      });
      await waitFor(() => expect(noteValues()).toContain('Edited elsewhere'));
    });
  });

  describe('deleting a note', () => {
    it('deletes a saved note after confirmation and keeps it hidden while the search still returns it', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-1', 'Called by mistake')]));
      deleteMock.mockResolvedValue({ encounterId: 'note-1' });
      renderGrid();
      await waitForVisits();

      await user.click(deleteButtonOf(noteInput('Called by mistake'))!);
      expect(within(deleteDialog()!).getByText('Delete Free Form')).toBeInTheDocument();
      expect(
        within(deleteDialog()!).getByText('Are you sure you want to delete this form? This action cannot be undone.')
      ).toBeInTheDocument();
      await confirmDelete(user);

      expect(deleteMock).toHaveBeenCalledWith(oystehrZambda, { patientId: PATIENT_A, encounterId: 'note-1' });
      await waitFor(() => expect(deleteDialog()).not.toBeInTheDocument());
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      expect(countOf('Called by mistake')).toBe(0);
    });

    it('keeps a deleted note hidden after switching patients and back, and after the grid remounts', async () => {
      const user = userEvent.setup();
      setHistory(
        PATIENT_A,
        historyOf(olderVisits(1), [freeForm('note-1', 'Deleted note'), freeForm('note-2', 'Kept note')])
      );
      setHistory(PATIENT_B, historyOf([visit('b-visit', '2026-02-01T10:00:00-05:00', 'Office of B')]));
      deleteMock.mockResolvedValue({ encounterId: 'note-1' });
      const { switchPatient } = renderGrid();
      await waitForVisits();

      await user.click(deleteButtonOf(noteInput('Deleted note'))!);
      await confirmDelete(user);
      await waitFor(() => expect(deleteDialog()).not.toBeInTheDocument());

      switchPatient(PATIENT_B);
      await screen.findByText('Office of B');
      switchPatient(PATIENT_A);
      await waitFor(() => expect(countOf('Kept note')).toBe(1));
      expect(countOf('Deleted note')).toBe(0);

      cleanup();
      renderGrid();
      await waitFor(() => expect(countOf('Kept note')).toBe(1));
      expect(countOf('Deleted note')).toBe(0);
    });

    it('keeps the note when Keep is chosen', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-1', 'Keep me')]));
      renderGrid();
      await waitForVisits();

      await user.click(deleteButtonOf(noteInput('Keep me'))!);
      await keepNote(user);

      expect(deleteMock).not.toHaveBeenCalled();
      expect(countOf('Keep me')).toBe(1);
    });

    it('keeps the dialog open and the note listed when the delete fails', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-1', 'Still here')]));
      deleteMock.mockRejectedValue(new Error('boom'));
      renderGrid();
      await waitForVisits();

      await user.click(deleteButtonOf(noteInput('Still here'))!);
      await confirmDelete(user);

      await waitFor(() =>
        expect(enqueueSnackbarMock).toHaveBeenCalledWith("Couldn't delete the note. Please try again.", {
          variant: 'error',
        })
      );
      expect(deleteDialog()).toBeInTheDocument();
      expect(countOf('Still here')).toBe(1);
    });

    it('shows no trash on an unsaved draft and adds it once the first save resolves', async () => {
      const user = userEvent.setup();
      const pending = deferred<FreeFormEncounterHistoryRow>();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      saveMock.mockReturnValue(pending.promise);
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      expect(deleteButtonOf(draftInput())).not.toBeInTheDocument();
      await user.type(draftInput(), 'Soon saved');
      await user.click(document.body);
      expect(deleteButtonOf(draftInput())).not.toBeInTheDocument();

      await act(async () => pending.resolve(freeForm('note-1', 'Soon saved')));

      await waitFor(() => expect(deleteButtonOf(noteInput('Soon saved'))).toBeInTheDocument());
    });

    it('discards an unsaved edit instead of saving it when the trash is clicked', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-1', 'Original text')]));
      renderGrid();
      await waitForVisits();
      const input = noteInput('Original text');

      await user.click(input);
      await user.type(input, ' plus an unsaved edit');
      await user.click(deleteButtonOf(input)!);

      expect(deleteDialog()).toBeInTheDocument();
      expect(saveMock).not.toHaveBeenCalled();

      await keepNote(user);

      expect(input.value).toBe('Original text');
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('moves back a page when the only row on the last page is deleted', async () => {
      const user = userEvent.setup();
      setHistory(
        PATIENT_A,
        historyOf(olderVisits(20), [freeForm('note-old', 'Oldest note', { dateTime: '2025-12-01T10:00:00.000Z' })])
      );
      deleteMock.mockResolvedValue({ encounterId: 'note-old' });
      renderGrid();
      await waitForVisits();
      await user.click(screen.getByRole('button', { name: 'Go to next page' }));
      expect(paginationText()).toBe('21–21 of 21');

      await user.click(deleteButtonOf(noteInput('Oldest note'))!);
      await confirmDelete(user);

      await waitFor(() => expect(paginationText()).toBe('1–20 of 20'));
      expect(screen.queryByText('No encounters found')).not.toBeInTheDocument();
    });

    it('closes the dialog when switching patients and does not reopen it on the way back', async () => {
      const user = userEvent.setup();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-a', 'Note for A')]));
      setHistory(PATIENT_B, historyOf([visit('b-visit', '2026-02-01T10:00:00-05:00', 'Office of B')]));
      const { switchPatient } = renderGrid();
      await waitForVisits();

      await user.click(deleteButtonOf(noteInput('Note for A'))!);
      expect(deleteDialog()).toBeInTheDocument();

      switchPatient(PATIENT_B);
      await waitFor(() => expect(deleteDialog()).not.toBeInTheDocument());
      switchPatient(PATIENT_A);
      await waitFor(() => expect(countOf('Note for A')).toBe(1));

      expect(deleteDialog()).not.toBeInTheDocument();
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it("leaves the next patient's rows and dialog alone when a delete finishes after switching", async () => {
      const user = userEvent.setup();
      const pending = deferred<DeleteFreeFormEncounterOutput>();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-a', 'Note for A')]));
      setHistory(
        PATIENT_B,
        historyOf([visit('b-visit', '2026-02-01T10:00:00-05:00', 'Office of B')], [freeForm('note-b', 'Note for B')])
      );
      deleteMock.mockReturnValueOnce(pending.promise);
      const { switchPatient } = renderGrid();
      await waitForVisits();

      await user.click(deleteButtonOf(noteInput('Note for A'))!);
      await confirmDelete(user);
      switchPatient(PATIENT_B);
      await waitFor(() => expect(countOf('Note for B')).toBe(1));
      await user.click(deleteButtonOf(noteInput('Note for B'))!);
      expect(within(deleteDialog()!).getByRole('button', { name: 'Delete' })).toBeEnabled();

      await act(async () => pending.resolve({ encounterId: 'note-a' }));

      expect(deleteDialog()).toBeInTheDocument();
      expect(within(deleteDialog()!).getByRole('button', { name: 'Delete' })).toBeEnabled();
      expect(countOf('Note for B')).toBe(1);

      await keepNote(user);
      switchPatient(PATIENT_A);
      await waitForVisits();
      expect(countOf('Note for A')).toBe(0);
    });

    it('reports a delete that fails after switching patients without touching the next patient', async () => {
      const user = userEvent.setup();
      const pending = deferred<DeleteFreeFormEncounterOutput>();
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-a', 'Note for A')]));
      setHistory(
        PATIENT_B,
        historyOf([visit('b-visit', '2026-02-01T10:00:00-05:00', 'Office of B')], [freeForm('note-b', 'Note for B')])
      );
      deleteMock.mockReturnValueOnce(pending.promise);
      const { switchPatient } = renderGrid();
      await waitForVisits();

      await user.click(deleteButtonOf(noteInput('Note for A'))!);
      await confirmDelete(user);
      switchPatient(PATIENT_B);
      await waitFor(() => expect(countOf('Note for B')).toBe(1));
      await waitFor(() => expect(deleteDialog()).not.toBeInTheDocument());

      await act(async () => pending.reject(new Error('boom')));

      expect(enqueueSnackbarMock).toHaveBeenCalledWith("Couldn't delete the free-form note for the previous patient.", {
        variant: 'error',
      });
      expect(deleteDialog()).not.toBeInTheDocument();
      expect(countOf('Note for B')).toBe(1);
    });
  });

  describe('deleting a draft that is still reconciling', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('stops reconciling once the delete is confirmed, so no warning appears while it is pending', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const pending = deferred<DeleteFreeFormEncounterOutput>();
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      saveMock.mockResolvedValue(freeForm('note-1', 'Created then deleted'));
      deleteMock.mockReturnValue(pending.promise);
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Created then deleted');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      await user.click(deleteButtonOf(noteInput('Created then deleted'))!);
      await confirmDelete(user);
      const callsAtConfirm = historyCalls.length;

      await advance(15_000);

      expect(historyCalls).toHaveLength(callsAtConfirm);
      expect(enqueueSnackbarMock).not.toHaveBeenCalledWith(RECONCILE_WARNING, expect.anything());

      await act(async () => pending.resolve({ encounterId: 'note-1' }));

      await waitFor(() => expect(deleteDialog()).not.toBeInTheDocument());
      expect(countOf('Created then deleted')).toBe(0);
      expect(addButton()).toBeEnabled();
    });

    it('keeps the note visible and editable after a failed delete, through stale refetches, and deletes it on retry', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const saved = freeForm('note-1', 'Survives a failed delete');
      const edited = { ...saved, note: 'Survives a failed delete, edited', lastUpdated: '2026-10-26T12:01:00.000Z' };
      setHistory(PATIENT_A, historyOf(olderVisits(1)));
      saveMock.mockResolvedValueOnce(saved).mockResolvedValueOnce(edited);
      deleteMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ encounterId: 'note-1' });
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Survives a failed delete');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      await user.click(deleteButtonOf(noteInput('Survives a failed delete'))!);
      await confirmDelete(user);
      await waitFor(() =>
        expect(enqueueSnackbarMock).toHaveBeenCalledWith("Couldn't delete the note. Please try again.", {
          variant: 'error',
        })
      );
      await keepNote(user);

      expect(addButton()).toBeEnabled();
      expect(countOf('Survives a failed delete')).toBe(1);
      expect(deleteButtonOf(noteInput('Survives a failed delete'))).toBeInTheDocument();
      await advance(15_000);
      expect(enqueueSnackbarMock).not.toHaveBeenCalledWith(RECONCILE_WARNING, expect.anything());

      const input = noteInput('Survives a failed delete');
      const callsBeforeEdit = historyCalls.length;
      await user.click(input);
      await user.type(input, ', edited');
      await user.click(document.body);

      expect(saveMock.mock.calls[1][1]).toEqual({
        patientId: PATIENT_A,
        encounterId: 'note-1',
        note: 'Survives a failed delete, edited',
      });
      await waitFor(() => expect(historyCalls.length).toBeGreaterThan(callsBeforeEdit));
      await waitFor(() => expect(countOf('Survives a failed delete, edited')).toBe(1));

      await user.click(deleteButtonOf(noteInput('Survives a failed delete, edited'))!);
      await confirmDelete(user);

      await waitFor(() => expect(deleteDialog()).not.toBeInTheDocument());
      expect(countOf('Survives a failed delete, edited')).toBe(0);
      expect(deleteMock).toHaveBeenCalledTimes(2);
    });

    it('lands on the page holding the note when a delete confirmed from another page fails', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      setHistory(PATIENT_A, historyOf(olderVisits(25)));
      saveMock.mockResolvedValue(freeForm('note-1', 'Confirmed from page two'));
      deleteMock.mockRejectedValue(new Error('boom'));
      renderGrid();
      await waitForVisits();

      await user.click(addButton());
      await user.type(draftInput(), 'Confirmed from page two');
      await user.click(document.body);
      await waitFor(() => expect(historyCalls).toHaveLength(2));
      await user.click(screen.getByRole('button', { name: 'Go to next page' }));
      expect(paginationText()).toBe('21–25 of 25');

      await user.click(deleteButtonOf(noteInput('Confirmed from page two'))!);
      await confirmDelete(user);
      await waitFor(() => expect(enqueueSnackbarMock).toHaveBeenCalled());
      await keepNote(user);

      expect(paginationText()).toBe('1–20 of 26');
      expect(countOf('Confirmed from page two')).toBe(1);
    });
  });

  describe('table layout', () => {
    it('titles the section Visits and links visits and follow-ups from one Actions column', async () => {
      const followUp = (overrides: Partial<FollowUpVisitHistoryRow>): FollowUpVisitHistoryRow => ({
        encounterId: 'fu',
        originalEncounterId: 'enc-visit-00',
        originalAppointmentId: 'visit-00',
        status: 'finished',
        type: 'Follow-up',
        dateTime: '2026-01-02T10:00:00-05:00',
        visitReason: undefined,
        office: 'Follow-up Office',
        provider: undefined,
        ...overrides,
      });
      const parent: AppointmentHistoryRow = {
        ...visit('visit-00', '2026-01-01T10:00:00-05:00'),
        followUps: [
          followUp({ encounterId: 'fu-scheduled', followupSubtype: 'scheduled', appointmentId: 'fu-appointment' }),
          followUp({
            encounterId: 'fu-annotation',
            followupSubtype: 'annotation',
            dateTime: '2026-01-03T10:00:00-05:00',
          }),
        ],
      };
      setHistory(PATIENT_A, historyOf([parent]));
      renderGrid();
      await waitForVisits();

      expect(screen.getByText('Visits - 7')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
        'Date & Time',
        'Status',
        'Type & Service Category',
        'Reason for visit',
        'Provider',
        'Office',
        'LOS',
        'Actions',
      ]);

      const [visitRow, scheduledRow, annotationRow] = screen.getAllByRole('row').slice(1);
      expect(within(visitRow).getByRole('link', { name: 'Visit Details' })).toHaveAttribute('href', '/visit/visit-00');
      expect(within(visitRow).getByRole('link', { name: 'Progress Note' })).toHaveAttribute(
        'href',
        '/in-person/visit-00/review-and-sign?encounterId=enc-visit-00'
      );
      expect(within(scheduledRow).getByRole('link', { name: 'Visit Details' })).toHaveAttribute(
        'href',
        '/visit/fu-appointment'
      );
      expect(within(scheduledRow).getByRole('link', { name: 'Progress Note' })).toHaveAttribute(
        'href',
        '/in-person/visit-00/review-and-sign?encounterId=fu-scheduled'
      );
      expect(within(annotationRow).queryByRole('link', { name: 'Visit Details' })).not.toBeInTheDocument();
      expect(within(annotationRow).getByRole('link', { name: 'Progress Note' })).toHaveAttribute(
        'href',
        '/in-person/visit-00/follow-up-note?encounterId=fu-annotation'
      );
    });

    it('spans free-form rows across the header and keeps the trash in the Actions column', async () => {
      setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-1', 'Lined up note')]));
      renderGrid();
      await waitForVisits();

      const cells = within(rowOf(noteInput('Lined up note'))).getAllByRole('cell');
      const spannedColumns = cells.reduce((sum, cell) => sum + Number(cell.getAttribute('colspan') ?? 1), 0);
      expect(spannedColumns).toBe(screen.getAllByRole('columnheader').length);
      expect(deleteButtonOf(noteInput('Lined up note'))).toBe(
        within(cells[cells.length - 1]).getByTestId(dataTestIds.patientRecordPage.freeFormDeleteButton)
      );
    });
  });

  it('hides free-form rows when a Type is chosen', async () => {
    const user = userEvent.setup();
    setHistory(PATIENT_A, historyOf(olderVisits(1), [freeForm('note-1', 'Visible only under All')]));
    renderGrid();
    await waitForVisits();
    expect(countOf('Visible only under All')).toBe(1);

    await chooseType(user, visitTypeToInPersonLabel['walk-in']);

    await waitFor(() => expect(countOf('Visible only under All')).toBe(0));
  });
});
