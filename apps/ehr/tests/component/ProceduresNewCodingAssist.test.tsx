const { saveChartDataMock, apiClientsMock, chartDataMock, routeParamsMock } = vi.hoisted(() => ({
  saveChartDataMock: vi.fn(),
  apiClientsMock: { current: { oystehrZambda: {} } as Record<string, unknown> },
  chartDataMock: { current: {} as Record<string, unknown> },
  routeParamsMock: { current: { id: 'appt-1' } as Record<string, string> },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => routeParamsMock.current,
  };
});

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => apiClientsMock.current,
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => false }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: vi.fn(),
  useMergedProcedureQuickPicks: () => ({ quickPicks: [], loading: false, refetch: vi.fn() }),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (cb: () => void) => cb() }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-coding-assist-test' } }),
  useChartData: () => ({ chartData: chartDataMock.current, setPartialChartData: vi.fn() }),
  useSaveChartData: () => ({ mutateAsync: saveChartDataMock }),
  useDeleteChartData: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({ isFetching: false, data: { codes: [] } }),
}));

vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../../src/components/input/AutocompleteInput', () => ({
  AutocompleteInput: () => <div />,
}));

vi.mock('../../src/components/WithTooltip', () => ({
  TooltipWrapper: ({ children }: any) => <div>{children}</div>,
  CPT_TOOLTIP_PROPS: {},
}));

vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/assessment-tab/DiagnosesField', () => ({
  DiagnosesField: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/InfoAlert', () => ({
  InfoAlert: () => <div />,
}));

vi.mock('../../src/api/api', () => ({
  createProcedureQuickPick: vi.fn(),
  getProcedureQuickPicks: vi.fn().mockResolvedValue({ quickPicks: [] }),
  updateProcedureQuickPick: vi.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  BODY_SIDES_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  MEDICATIONS_USED_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  SUPPLIES_VALUE_SET_URL,
} from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProceduresNew from '../../src/features/visits/in-person/pages/ProceduresNew';
import { useProcedureStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-coding-assist-test';

const DETERMINED_DRAFT = {
  procedureType: 'Laceration Repair',
  bodySite: 'Hand',
  bodySide: 'Left',
  procedureDetails:
    'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon, total stitch count: 8. ' +
    'Wound length: 3.2 cm. Lidocaine 1% infiltrated. Wound irrigated with NS. Tetanus up to date.',
};

const createWrapper = (): ((props: { children: ReactNode }) => JSX.Element) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const renderComponent = (): ReturnType<typeof render> => render(<ProceduresNew />, { wrapper: createWrapper() });

const waitForEvaluation = async (): Promise<void> => {
  await waitFor(
    () => {
      expect(screen.queryByTestId('coding-assist-loading')).not.toBeInTheDocument();
    },
    { timeout: 3000 }
  );
};

describe('ProceduresNew — deterministic coding assist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveChartDataMock.mockResolvedValue({});
    const valueSet = (url: string, displays: string[]): unknown => ({
      resourceType: 'ValueSet',
      id: `${url.split('/').at(-1)}-1`,
      url,
      version: '1',
      expansion: { contains: displays.map((display) => ({ code: display.toLowerCase(), display })) },
    });
    const search = vi.fn().mockResolvedValue({
      unbundle: () => [
        valueSet(BODY_SITES_VALUE_SET_URL, ['Hand']),
        valueSet(BODY_SIDES_VALUE_SET_URL, ['Left']),
        valueSet(MEDICATIONS_USED_VALUE_SET_URL, ['Albuterol 2.5 mg']),
        valueSet(PATIENT_RESPONSES_VALUE_SET_URL, ['Tolerated Well', 'Tolerated well']),
      ],
    });
    apiClientsMock.current = { oystehrZambda: {}, oystehr: { fhir: { search } } };
    chartDataMock.current = {};
    routeParamsMock.current = { id: 'appt-1' };
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
  });

  it('renders the deterministic best-match row when the documentation determines the code', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, DETERMINED_DRAFT);
    renderComponent();
    expect(await screen.findByText(/^best match$/i, undefined, { timeout: 3000 })).toBeVisible();
    const bestMatch = screen.getByTestId('best-match-cpt-code');
    expect(bestMatch).toHaveTextContent('12042');
    expect(bestMatch).toHaveTextContent(/layered closure documented/i);
    expect(bestMatch).toHaveTextContent(/3\.2 cm/);
  });

  it('renders no legacy AI list for an engine-covered family', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, DETERMINED_DRAFT);
    renderComponent();
    await screen.findByText(/^best match$/i, undefined, { timeout: 3000 });
    expect(screen.queryByTestId('recommended-cpt-code-99213')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('recommended-cpt-code-12042')).toHaveLength(1);
  });

  it('never leaves the panel empty: the rules vintage and a state are always present', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, DETERMINED_DRAFT);
    renderComponent();
    expect(screen.getByTestId('coding-rules-vintage')).toHaveTextContent('Checks current as of CPT 2026');
    expect(screen.getByTestId('coding-assist-loading')).toBeVisible();
    await waitForEvaluation();
    expect(screen.getByTestId('best-match-cpt-code')).toBeVisible();
  });

  it('renders the engine not-assessed reason for an uncovered type (X-Ray)', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'X-Ray',
      cptCodes: [{ code: '73562', display: 'X-ray of knee, 3 views' }],
    });
    renderComponent();
    const notAssessed = await screen.findByTestId('coding-assist-not-assessed', undefined, { timeout: 3000 });
    expect(notAssessed).toHaveTextContent('not covered by the documentation checks');
    expect(screen.queryByTestId('best-match-cpt-code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-candidates-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coding-assist-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coding-defense-findings')).not.toBeInTheDocument();
  });

  it('renders the fixed-code suggestion and supported state for a fixed-code type (nebulizer)', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Nebulizer Treatment (e.g., Albuterol)',
      cptCodes: [{ code: '94640', display: 'Inhalation treatment (nebulizer)' }],
      medicationUsed: 'Albuterol 2.5 mg',
      patientResponse: 'Tolerated Well',
    });
    renderComponent();
    const bestMatch = await screen.findByTestId('best-match-cpt-code', undefined, { timeout: 3000 });
    expect(bestMatch).toHaveTextContent('94640');
    expect(bestMatch).toHaveTextContent(/bills a single code/i);
    const supported = await screen.findByTestId('coding-defense-supported', undefined, { timeout: 3000 });
    expect(supported).toHaveTextContent('Documentation supports 94640');
  });

  it('renders the compact open-set line when class and site are known but length is missing', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Laceration Repair',
      bodySite: 'Hand',
      procedureDetails: 'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon.',
    });
    renderComponent();
    expect(
      await screen.findByText('12041–12047 — wound length (cm) determines the exact code', undefined, { timeout: 3000 })
    ).toBeVisible();
    expect(screen.queryByTestId('best-match-cpt-code')).not.toBeInTheDocument();
  });

  it('renders the open candidate set as a list when the determinant is missing', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'EKG',
      cptCodes: [{ code: '93000', display: 'Electrocardiogram, complete' }],
    });
    renderComponent();
    const candidates = await screen.findByTestId('open-candidates-list', undefined, { timeout: 3000 });
    expect(candidates).toHaveTextContent('93000');
    expect(candidates).toHaveTextContent('93005');
    expect(candidates).toHaveTextContent('93010');
    expect(screen.getByTestId('open-candidate-93005')).toHaveTextContent(/tracing only/i);
    expect(screen.getByText('Possible codes')).toBeVisible();
    expect(screen.queryByTestId('best-match-cpt-code')).not.toBeInTheDocument();
  });

  it('renders the forward missing-determinant finding alongside the candidate list', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'EKG' });
    renderComponent();
    const findings = await screen.findByTestId('coding-assist-findings', undefined, { timeout: 3000 });
    expect(findings).toHaveTextContent(/no 12-lead tracing or interpretation & report is documented/i);
    expect(findings).toHaveTextContent(/Procedure details/i);
  });

  it('renders the defense not-assessed line only when the forward panel has something to say', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Suture / Staple Removal',
      cptCodes: [{ code: '99213', display: 'Office visit' }],
    });
    renderComponent();
    await screen.findByTestId('coding-assist-not-assessed', undefined, { timeout: 3000 });
    expect(screen.queryByTestId('coding-defense-findings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coding-defense-supported')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coding-defense-not-assessed')).not.toBeInTheDocument();
  });

  it('renders defense findings grouped per selected code, with the contradiction citation', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...DETERMINED_DRAFT,
      cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5cm' }],
    });
    renderComponent();
    const findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).toHaveTextContent('12002');
    expect(findings).toHaveTextContent(/simple-repair code, but the note documents/i);
    expect(findings).toHaveTextContent(/layered closure/i);
    expect(screen.getByText('Documentation check')).toBeVisible();
    expect(screen.queryByText(/Oystehr AI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI generated outputs/i)).not.toBeInTheDocument();
  });

  it('renders the quiet positive state with the rules vintage when all selected codes are supported', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...DETERMINED_DRAFT,
      cptCodes: [{ code: '12042', display: 'Repair intermediate 2.6-7.5cm' }],
    });
    renderComponent();
    const supported = await screen.findByTestId('coding-defense-supported', undefined, { timeout: 3000 });
    expect(supported).toHaveTextContent('Documentation supports 12042');
    expect(screen.getByTestId('coding-rules-vintage')).toHaveTextContent(/CPT 2026/);
    expect(screen.queryByTestId('coding-defense-findings')).not.toBeInTheDocument();
  });

  it('shows documentation reminders alongside green support without letting them suppress it', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Splint Application',
      bodySite: 'Hand',
      bodySide: 'Left',
      cptCodes: [{ code: '29125', display: 'Application of short arm splint; static' }],
      procedureDetails:
        'Static short arm splint molded and applied by me. ' +
        'Pre-application neurovascular exam: pulses and sensation intact. ' +
        'Post-application neurovascular exam: pulses, motor, and sensation intact. ' +
        'Splint care and elevation reviewed.',
    });
    renderComponent();

    expect(await screen.findByTestId('coding-defense-supported', undefined, { timeout: 3000 })).toHaveTextContent(
      'Documentation supports 29125'
    );
    expect(screen.getByTestId('coding-defense-findings')).toHaveTextContent(/splint material is not documented/i);
  });

  it('renders a neutral not-assessed line for uncovered codes when other assist elements are visible', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...DETERMINED_DRAFT,
      cptCodes: [
        { code: '12042', display: 'Repair intermediate 2.6-7.5cm' },
        { code: '99214', display: 'Office visit' },
      ],
    });
    renderComponent();
    const notAssessed = await screen.findByTestId('coding-defense-not-assessed', undefined, { timeout: 3000 });
    expect(notAssessed).toHaveTextContent('99214 — not assessed by documentation checks');
  });

  it('covers the retired legacy nag: empty closure details ⇒ the engine closure [R] finding', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Laceration Repair',
      cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5cm' }],
    });
    renderComponent();
    const findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).toHaveTextContent(/not documented: closure method, suture material, suture count/i);
  });

  const COMPOUND_DRAFT = {
    procedureType: 'Laceration Repair',
    bodySite: 'Hand',
    lengthCm: 14,
    procedureDetails:
      'Extensive undermining performed. Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon, total stitch count: 8.',
  };

  it('one click on a compound best-match row adds the primary and each add-on code', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, COMPOUND_DRAFT);
    renderComponent();
    const bestMatch = await screen.findByTestId('best-match-cpt-code', undefined, { timeout: 3000 });
    expect(bestMatch).toHaveTextContent('13132');
    await user.click(screen.getByTestId('cpt-code-quick-add-13132'));
    const cptEntries = screen.getAllByTestId('cpt-code').map((entry) => entry.textContent ?? '');
    expect(cptEntries.some((text) => text.includes('13132'))).toBe(true);
    expect(cptEntries.some((text) => text.includes('13133') && text.includes('(× 2)'))).toBe(true);
    expect(
      useProcedureStore
        .getState()
        .getDraft(ENCOUNTER_ID)
        .cptCodes?.find((code) => code.code === '13133')
    ).toMatchObject({ billableUnits: 2 });
    expect(await screen.findByLabelText('CPT code 13132 already added')).toBeInTheDocument();
  });

  it('keeps the add button available while an add-on of the compound suggestion is missing', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...COMPOUND_DRAFT,
      cptCodes: [{ code: '13132', display: 'Complex repair 2.6-7.5cm' }],
    });
    renderComponent();
    await screen.findByTestId('best-match-cpt-code', undefined, { timeout: 3000 });
    const addButton = screen.getByTestId('cpt-code-quick-add-13132');
    expect(addButton).toBeVisible();
    await user.click(addButton);
    const cptEntries = screen.getAllByTestId('cpt-code').map((entry) => entry.textContent ?? '');
    expect(cptEntries.filter((text) => text.includes('13132'))).toHaveLength(1);
    expect(cptEntries.some((text) => text.includes('13133'))).toBe(true);
  });

  it('updates an existing add-on to the recommended unit count', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...COMPOUND_DRAFT,
      cptCodes: [
        { code: '13132', display: 'Complex repair 2.6-7.5cm' },
        { resourceId: 'existing-addon', code: '13133', display: 'Each additional 5cm', billableUnits: 1 },
      ],
    });
    renderComponent();
    await screen.findByTestId('best-match-cpt-code', undefined, { timeout: 3000 });
    await user.click(screen.getByTestId('cpt-code-quick-add-13132'));
    expect(
      useProcedureStore
        .getState()
        .getDraft(ENCOUNTER_ID)
        .cptCodes?.find((code) => code.code === '13133')
    ).toMatchObject({ billableUnits: 2 });
    expect(await screen.findByLabelText('CPT code 13132 already added')).toBeInTheDocument();
    await user.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(saveChartDataMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cptCodes: expect.arrayContaining([
            expect.objectContaining({ resourceId: 'existing-addon', code: '13133', billableUnits: 2 }),
          ]),
        })
      );
    });
  });

  it('shows the length input for a laceration-family procedure type', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair' });
    renderComponent();
    expect(await screen.findByTestId('length-cm-input')).toBeVisible();
  });

  it('hides the length input for a procedure type outside length-based families', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'EKG' });
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByTestId('length-cm-input')).not.toBeInTheDocument();
    });
  });

  it('restores a saved length value into the input', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair', lengthCm: 3.2 });
    renderComponent();
    const input = (await screen.findByTestId('length-cm-input')).querySelector('input');
    expect(input).toHaveValue(3.2);
  });

  it('shows the Repair depth select for a laceration-family procedure type', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair' });
    renderComponent();
    expect(await screen.findByTestId('repair-depth-select')).toBeVisible();
  });

  it('hides the Repair depth select for a procedure type outside repair-depth families', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'EKG' });
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByTestId('repair-depth-select')).not.toBeInTheDocument();
    });
  });

  it('flows a Repair depth selection into the best-match row: hand + 3.2 cm + layered ⇒ 12042', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Laceration Repair',
      bodySite: 'Hand',
      lengthCm: 3.2,
      procedureDetails: 'Closed with 5 simple interrupted 4-0 Ethilon sutures.',
    });
    renderComponent();
    const select = await screen.findByTestId('repair-depth-select');
    await user.click(select.querySelector('[role="combobox"]') as Element);
    await user.click(await screen.findByText('Subcutaneous — layered closure'));
    const bestMatch = await screen.findByTestId('best-match-cpt-code', undefined, { timeout: 3000 });
    expect(bestMatch).toHaveTextContent('12042');
    expect(bestMatch).toHaveTextContent(/Repair depth field/i);
  });

  it('restores a saved Repair depth value into the select', async () => {
    useProcedureStore
      .getState()
      .setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair', repairDepth: 'subcutaneous-layered' });
    renderComponent();
    const select = await screen.findByTestId('repair-depth-select');
    expect(select).toHaveTextContent('Subcutaneous — layered closure');
  });

  it('round-trips the Repair depth value through the save payload', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Laceration Repair',
      repairDepth: 'fascia-muscle-layered',
    });
    renderComponent();
    await screen.findByTestId('repair-depth-select');
    await user.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(saveChartDataMock).toHaveBeenCalledWith(
        expect.objectContaining({
          procedures: [expect.objectContaining({ repairDepth: 'fascia-muscle-layered' })],
        })
      );
    });
  });

  it('shows the Start/Stop time inputs for an IV-hydration procedure type', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'IV Fluid Administration' });
    renderComponent();
    expect(await screen.findByTestId('infusion-start-time-input')).toBeVisible();
    expect(screen.getByTestId('infusion-stop-time-input')).toBeVisible();
  });

  it('does not show timed-infusion inputs for an IM injection in the same coding family', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Intramuscular (IM) Medication Injection',
    });
    renderComponent();
    await screen.findByText(/CPT code — from your documentation/i, undefined, { timeout: 3000 });
    expect(screen.queryByTestId('infusion-start-time-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('infusion-stop-time-input')).not.toBeInTheDocument();
  });

  it('hides the infusion time inputs for procedure types outside the injection/infusion family', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair' });
    const { unmount } = renderComponent();
    await screen.findByTestId('length-cm-input');
    expect(screen.queryByTestId('infusion-start-time-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('infusion-stop-time-input')).not.toBeInTheDocument();
    unmount();

    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'EKG' });
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByTestId('infusion-start-time-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('infusion-stop-time-input')).not.toBeInTheDocument();
    });
  });

  it('restores saved infusion times into the inputs', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      infusionStartTime: '13:00',
      infusionStopTime: '13:42',
    });
    renderComponent();
    const startInput = await screen.findByTestId('infusion-start-time-input');
    const stopInput = screen.getByTestId('infusion-stop-time-input');
    expect(startInput).toHaveValue('01:00 PM');
    expect(stopInput).toHaveValue('01:42 PM');
  });

  it('round-trips the infusion times through the save payload', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      infusionStartTime: '13:00',
      infusionStopTime: '13:42',
    });
    renderComponent();
    await screen.findByTestId('infusion-start-time-input');
    await user.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(saveChartDataMock).toHaveBeenCalledWith(
        expect.objectContaining({
          procedures: [expect.objectContaining({ infusionStartTime: '13:00', infusionStopTime: '13:42' })],
        })
      );
    });
  });

  it('shows the computed duration caption when both times are set', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      infusionStartTime: '13:00',
      infusionStopTime: '13:42',
    });
    renderComponent();
    const caption = await screen.findByTestId('infusion-duration-caption');
    expect(caption).toHaveTextContent('42 min');
  });

  it('hides the duration caption while a time is missing', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      infusionStartTime: '13:00',
    });
    renderComponent();
    await screen.findByTestId('infusion-start-time-input');
    expect(screen.queryByTestId('infusion-duration-caption')).not.toBeInTheDocument();
  });

  it('renders the 96360 hydration floor contradiction when the typed span is under 31 minutes', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      cptCodes: [{ code: '96360', display: 'IV infusion, hydration; initial, 31 minutes to 1 hour' }],
    });
    renderComponent();
    await user.type(await screen.findByTestId('infusion-start-time-input'), '0205PM');
    await user.type(screen.getByTestId('infusion-stop-time-input'), '0225PM');
    expect(await screen.findByTestId('infusion-duration-caption')).toHaveTextContent('20 min');
    await waitFor(
      () => {
        const findings = screen.getByTestId('coding-defense-findings');
        expect(findings).toHaveTextContent('96360');
        expect(findings).toHaveTextContent(/96360 requires at least 31 minutes of hydration/i);
        expect(findings).toHaveTextContent(/total 20 minutes/i);
      },
      { timeout: 3000 }
    );
  });

  it('raises no duration finding for 96360 once the typed span reaches the floor', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      cptCodes: [{ code: '96360', display: 'IV infusion, hydration; initial, 31 minutes to 1 hour' }],
    });
    renderComponent();
    await user.type(await screen.findByTestId('infusion-start-time-input'), '0205PM');
    await user.type(screen.getByTestId('infusion-stop-time-input'), '0240PM');
    expect(await screen.findByTestId('infusion-duration-caption')).toHaveTextContent('35 min');
    await waitFor(
      () => {
        const findings = screen.getByTestId('coding-defense-findings');
        expect(findings).not.toHaveTextContent(/Start and stop times are not documented/i);
        expect(findings).not.toHaveTextContent(/at least 31 minutes of hydration/i);
      },
      { timeout: 3000 }
    );
  });

  it('renders the IV-push contradiction for 96365 when the typed span is 15 minutes or less', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      cptCodes: [
        {
          code: '96365',
          display: 'IV infusion, for therapy, prophylaxis, or diagnosis; initial, up to 1 hour',
        },
      ],
    });
    renderComponent();
    await user.type(await screen.findByTestId('infusion-start-time-input'), '0205PM');
    await user.type(screen.getByTestId('infusion-stop-time-input'), '0212PM');
    expect(await screen.findByTestId('infusion-duration-caption')).toHaveTextContent('7 min');
    await waitFor(
      () => {
        const findings = screen.getByTestId('coding-defense-findings');
        expect(findings).toHaveTextContent('96365');
        expect(findings).toHaveTextContent(/15 minutes or less is an IV push, reported with 96374 rather than 96365/i);
      },
      { timeout: 3000 }
    );
  });

  it('accepts a decimal wound size typed character by character and feeds it to the engine', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Laceration Repair',
      bodySite: 'Hand',
      procedureDetails: 'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon.',
    });
    renderComponent();
    const input = (await screen.findByTestId('length-cm-input')).querySelector('input') as HTMLInputElement;
    await user.type(input, '3.2');
    expect(input.value).toBe('3.2');
    const bestMatch = await screen.findByTestId('best-match-cpt-code', undefined, { timeout: 3000 });
    expect(bestMatch).toHaveTextContent('12042');
    expect(bestMatch).toHaveTextContent('3.2 cm');
  });

  it('reports an out-of-range wound size at the field and keeps it out of the save payload', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair' });
    renderComponent();
    const input = (await screen.findByTestId('length-cm-input')).querySelector('input') as HTMLInputElement;
    await user.type(input, '0');
    expect(screen.getByText(/between 0.1 and 100 cm/i)).toBeVisible();
    expect(input.value).toBe('0');
    await user.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(saveChartDataMock).toHaveBeenCalledWith(
        expect.objectContaining({ procedures: [expect.objectContaining({ lengthCm: undefined })] })
      );
    });
  });

  it('accepts a plausible infusion that crosses midnight', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      infusionStartTime: '23:50',
      infusionStopTime: '00:20',
    });
    renderComponent();
    await screen.findByTestId('infusion-stop-time-input');
    expect(screen.queryByText(/Check these times/i)).not.toBeInTheDocument();
    expect(await screen.findByTestId('infusion-duration-caption')).toHaveTextContent('30 min');
  });

  it('flags an implausibly long inferred cross-midnight infusion', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'IV Fluid Administration',
      infusionStartTime: '14:30',
      infusionStopTime: '14:00',
    });
    renderComponent();
    await screen.findByTestId('infusion-stop-time-input');
    expect(screen.getByText('Check these times — the span is 1410 minutes')).toBeVisible();
  });

  it('waits for select options before parsing an existing procedure', async () => {
    const user = userEvent.setup();
    routeParamsMock.current = { id: 'appt-1', procedureId: 'procedure-1' };
    chartDataMock.current = {
      procedures: [
        {
          resourceId: 'procedure-1',
          procedureType: 'Laceration Repair',
          procedureDateTime: '2026-09-03T12:00:00.000Z',
          suppliesUsed: 'Gauze',
        },
      ],
    };
    apiClientsMock.current = { oystehrZambda: {} };
    const { rerender } = renderComponent();

    const suppliesValueSet = {
      resourceType: 'ValueSet',
      id: 'procedure-supplies-1',
      url: SUPPLIES_VALUE_SET_URL,
      version: '1',
      expansion: { contains: [{ code: 'gauze', display: 'Gauze' }] },
    };
    const search = vi.fn().mockResolvedValue({
      total: 1,
      entry: [{ resource: suppliesValueSet, search: { mode: 'match' } }],
      unbundle: () => [suppliesValueSet],
    });
    apiClientsMock.current = { oystehrZambda: {}, oystehr: { fhir: { search } } };
    rerender(<ProceduresNew />);

    await waitFor(() => expect(search).toHaveBeenCalled());
    await user.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(saveChartDataMock).toHaveBeenCalledWith(
        expect.objectContaining({
          procedures: [expect.objectContaining({ resourceId: 'procedure-1', suppliesUsed: 'Gauze' })],
        })
      );
    });
  });

  it('reads the newest version when several ValueSets share a URL', async () => {
    const user = userEvent.setup();
    const bodySites = (version: string, displays: string[]): unknown => ({
      resourceType: 'ValueSet',
      id: `body-sites-${version}`,
      url: BODY_SITES_VALUE_SET_URL,
      version,
      expansion: { contains: displays.map((display) => ({ code: display.toLowerCase(), display })) },
    });
    const search = vi.fn().mockResolvedValue({
      unbundle: () => [bodySites('1', ['Arm']), bodySites('2', ['Arm', 'Finger'])],
    });
    apiClientsMock.current = { oystehrZambda: {}, oystehr: { fhir: { search } } };
    renderComponent();
    await waitFor(() => {
      expect(search).toHaveBeenCalled();
    });
    const site = await screen.findByTestId('site');
    await user.click(site.querySelector('[role="combobox"]') as Element);
    expect(await screen.findByText('Finger', undefined, { timeout: 3000 })).toBeVisible();
  });

  it('renders the tolerance best-practice line for 96372 until Patient response is documented', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Intramuscular (IM) Medication Injection',
      cptCodes: [{ code: '96372', display: 'Therapeutic injection; subcutaneous or intramuscular' }],
    });
    const { unmount } = renderComponent();
    let findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).toHaveTextContent(/patient tolerance is not documented/i);
    unmount();

    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Intramuscular (IM) Medication Injection',
      cptCodes: [{ code: '96372', display: 'Therapeutic injection; subcutaneous or intramuscular' }],
      patientResponse: 'Tolerated well',
    });
    renderComponent();
    findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).not.toHaveTextContent(/patient tolerance is not documented/i);
  });

  it('counts Performed by as clinician-application evidence for a splint code', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Splint Application',
      cptCodes: [{ code: '29125', display: 'Application of short arm splint; static' }],
    });
    const { unmount } = renderComponent();
    let findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).toHaveTextContent(/application by the clinician is not documented/i);
    unmount();

    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Splint Application',
      cptCodes: [{ code: '29125', display: 'Application of short arm splint; static' }],
      performerType: 'Provider',
    });
    renderComponent();
    findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).not.toHaveTextContent(/application by the clinician is not documented/i);
  });

  it('counts Post-procedure instructions (including Other free text) as instructions documented', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Splint Application',
      cptCodes: [{ code: '29125', display: 'Application of short arm splint; static' }],
    });
    const { unmount } = renderComponent();
    let findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).toHaveTextContent(/patient instructions are not documented/i);
    expect(findings).toHaveTextContent(/splint material is not documented/i);
    unmount();

    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Splint Application',
      cptCodes: [{ code: '29125', display: 'Application of short arm splint; static' }],
      postInstructions: ['Other'],
      otherPostInstructions: 'Splint care and elevation reviewed',
    });
    renderComponent();
    findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).not.toHaveTextContent(/patient instructions are not documented/i);
    expect(findings).toHaveTextContent(/splint material is not documented/i);
  });
});
