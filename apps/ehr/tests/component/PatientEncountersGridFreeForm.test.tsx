import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  AppointmentHistoryRow,
  FreeFormEncounterHistoryRow,
  PatientVisitListResponse,
} from 'utils/lib/types/api/patient-visit-history.types';
import { ServiceMode } from 'utils/lib/types/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientEncountersGrid } from '../../src/components/PatientEncountersGrid';
import { dataTestIds } from '../../src/constants/data-test-ids';
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
vi.mock('../../src/api/api', () => ({
  saveFreeFormEncounter: (...args: unknown[]) => saveMock(...args),
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

const sortAscending = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const header = screen.getByText('Date & Time').closest('th') as HTMLElement;
  await user.click(within(header).getByRole('button'));
};

describe('PatientEncountersGrid free-form encounters', () => {
  beforeEach(() => {
    routePatientId = PATIENT_A;
    historyQueues.clear();
    historyCalls.length = 0;
    saveMock.mockReset();
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
