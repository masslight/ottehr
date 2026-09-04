const { procedureCodingModel } = vi.hoisted(() => ({
  procedureCodingModel: import('utils/lib/procedure-coding/model.types'),
}));

vi.mock('utils', async () => {
  const model = await procedureCodingModel;
  const format = await import('utils/lib/procedure-coding/format');
  return {
    ...model,
    ...format,
    MAX_PLAUSIBLE_LENGTH_CM: 100,
    isPlausibleLengthCm: (value: number | undefined) =>
      value !== undefined && Number.isFinite(value) && value > 0 && value <= 100,
    extractInfusionDuration: (input: { infusionStartTime?: string; infusionStopTime?: string }) => {
      const startMinutes = format.parseClockTime(input.infusionStartTime);
      const stopMinutes = format.parseClockTime(input.infusionStopTime);
      if (startMinutes === undefined || stopMinutes === undefined) return undefined;
      const duration = format.clockSpan(startMinutes, stopMinutes);
      return {
        startMinutes,
        stopMinutes,
        ...duration,
        implausible: duration.durationMinutes > 12 * 60,
        evidence: { source: model.EvidenceSource.Field, field: 'Infusion start / stop times' },
      };
    },
  };
});

vi.mock('@mui/x-date-pickers/AdapterLuxon', () => ({ AdapterLuxon: class AdapterLuxon {} }));

vi.mock('@mui/x-date-pickers-pro', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) => children,
  TimePicker: ({
    label,
    value,
    slotProps,
  }: {
    label: string;
    value: { toFormat: (format: string) => string } | null;
    slotProps?: { textField?: { inputProps?: Record<string, string>; helperText?: string } };
  }) => (
    <label>
      {label}
      <input {...slotProps?.textField?.inputProps} value={value?.toFormat('HH:mm') ?? ''} readOnly />
      {slotProps?.textField?.helperText}
    </label>
  ),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import {
  CodeAssessmentKind,
  CodeOutcome,
  CodeOutcomeKind,
  EvaluationFamilyMatchKind,
  EvaluationResult,
  EvidenceSource,
  Finding,
  FindingScopeKind,
} from 'utils/lib/procedure-coding/model.types';
import { describe, expect, it, vi } from 'vitest';
import { CodingAssistPanel } from '../../src/features/visits/in-person/components/procedures/coding-assist/CodingAssistPanel';
import { DocumentationCheck } from '../../src/features/visits/in-person/components/procedures/coding-assist/DocumentationCheck';
import { ConditionalCodingFields } from '../../src/features/visits/in-person/components/procedures/ConditionalCodingFields';
import { ProcedureCptCodesField } from '../../src/features/visits/in-person/components/procedures/ProcedureCptCodesField';
import {
  ProcedureDropdown,
  ProcedureMultiSelect,
} from '../../src/features/visits/in-person/components/procedures/ProcedureFormFields';

const RULES_VINTAGE = 'CPT 2026';

function evaluation(
  outcome: CodeOutcome,
  options: {
    findings?: Finding[];
    assessments?: Array<[string, CodeAssessmentKind]>;
  } = {}
): EvaluationResult {
  return {
    family: { kind: EvaluationFamilyMatchKind.Matched, id: 'test-family' },
    rulesVintage: RULES_VINTAGE,
    outcome,
    findings: options.findings ?? [],
    codeAssessments: new Map(options.assessments?.map(([code, kind]) => [code, { kind }]) ?? []),
    payerNotes: [],
  };
}

const noDefense = (): EvaluationResult => evaluation({ kind: CodeOutcomeKind.NotApplicable });

function suggestionVisible(kind: CodeOutcomeKind): boolean {
  return (
    kind === CodeOutcomeKind.Determined ||
    kind === CodeOutcomeKind.DeterminedWithAlternates ||
    kind === CodeOutcomeKind.Open
  );
}

function renderAssistance(
  suggestion: EvaluationResult,
  defense = noDefense(),
  selectedCodes: Array<{ code: string; display: string; billableUnits?: number }> = []
): { onAddCodes: ReturnType<typeof vi.fn> } {
  const onAddCodes = vi.fn();
  render(
    <>
      <CodingAssistPanel
        evaluation={suggestion}
        isEvaluating={false}
        rulesVintage={RULES_VINTAGE}
        procedureTypeSelected
        isReadOnly={false}
        selectedCodes={selectedCodes}
        onAddCodes={onAddCodes}
      />
      <DocumentationCheck evaluation={defense} suggestionVisible={suggestionVisible(suggestion.outcome.kind)} />
    </>
  );
  return { onAddCodes };
}

describe('procedure coding assistance presentation', () => {
  it('renders a determined best match and its explanation', () => {
    renderAssistance(
      evaluation({
        kind: CodeOutcomeKind.Determined,
        suggestion: {
          code: '12042',
          display: '12042 — Intermediate repair, hand, 2.6–7.5 cm',
          justification: 'Layered closure documented; hand; 3.2 cm.',
        },
      })
    );

    const bestMatch = screen.getByTestId('best-match-cpt-code');
    expect(bestMatch).toHaveTextContent('12042');
    expect(bestMatch).toHaveTextContent('Layered closure documented; hand; 3.2 cm.');
    expect(screen.getByTestId('coding-rules-vintage')).toHaveTextContent(`Checks current as of ${RULES_VINTAGE}`);
  });

  it('renders loading and not-assessed states', () => {
    const { rerender } = render(
      <CodingAssistPanel
        evaluation={undefined}
        isEvaluating
        rulesVintage={RULES_VINTAGE}
        procedureTypeSelected
        isReadOnly={false}
        selectedCodes={[]}
        onAddCodes={vi.fn()}
      />
    );
    expect(screen.getByTestId('coding-assist-loading')).toBeVisible();

    rerender(
      <CodingAssistPanel
        evaluation={evaluation({
          kind: CodeOutcomeKind.NotAssessed,
          reason: 'This procedure type is not covered by the documentation checks.',
        })}
        isEvaluating={false}
        rulesVintage={RULES_VINTAGE}
        procedureTypeSelected
        isReadOnly={false}
        selectedCodes={[]}
        onAddCodes={vi.fn()}
      />
    );
    expect(screen.getByTestId('coding-assist-not-assessed')).toHaveTextContent(
      'not covered by the documentation checks'
    );
  });

  it('renders compact and enumerated open outcomes', () => {
    const { rerender } = render(
      <CodingAssistPanel
        evaluation={evaluation({
          kind: CodeOutcomeKind.Open,
          summary: '12041–12047 — wound length (cm) determines the exact code',
          candidates: [],
        })}
        isEvaluating={false}
        rulesVintage={RULES_VINTAGE}
        procedureTypeSelected
        isReadOnly={false}
        selectedCodes={[]}
        onAddCodes={vi.fn()}
      />
    );
    expect(screen.getByText('12041–12047 — wound length (cm) determines the exact code')).toBeVisible();

    rerender(
      <CodingAssistPanel
        evaluation={evaluation({
          kind: CodeOutcomeKind.Open,
          summary: 'The documented EKG service determines the code.',
          candidates: [
            { code: '93000', display: 'Tracing and interpretation' },
            { code: '93005', display: 'Tracing only' },
            { code: '93010', display: 'Interpretation only' },
          ],
        })}
        isEvaluating={false}
        rulesVintage={RULES_VINTAGE}
        procedureTypeSelected
        isReadOnly={false}
        selectedCodes={[]}
        onAddCodes={vi.fn()}
      />
    );
    const candidates = screen.getByTestId('open-candidates-list');
    expect(candidates).toHaveTextContent('93000');
    expect(candidates).toHaveTextContent('93005');
    expect(candidates).toHaveTextContent('93010');
  });

  it('groups defense findings by code and cites contradictory note text', () => {
    const contradiction: Finding = {
      level: 'contradiction',
      message: 'The selected simple-repair code conflicts with the documented layered closure.',
      scope: { kind: FindingScopeKind.Code, cptCode: '12002' },
      evidence: { source: EvidenceSource.Text, sourceText: 'Layered closure performed.' },
    };
    renderAssistance(
      evaluation({ kind: CodeOutcomeKind.NoCode }),
      evaluation(
        { kind: CodeOutcomeKind.NotApplicable },
        {
          findings: [contradiction],
          assessments: [['12002', CodeAssessmentKind.Unsupported]],
        }
      )
    );

    const findings = screen.getByTestId('coding-defense-findings');
    expect(findings).toHaveTextContent('12002');
    expect(findings).toHaveTextContent('simple-repair code');
    expect(findings).toHaveTextContent('Layered closure performed.');
  });

  it('shows supported, reminder, and unassessed code states together', () => {
    const reminder: Finding = {
      level: 'bestPractice',
      message: 'Splint material is not documented.',
      scope: { kind: FindingScopeKind.Code, cptCode: '29125' },
      evidence: { source: EvidenceSource.Absence },
    };
    renderAssistance(
      evaluation({ kind: CodeOutcomeKind.NoCode }),
      evaluation(
        { kind: CodeOutcomeKind.NotApplicable },
        {
          findings: [reminder],
          assessments: [
            ['29125', CodeAssessmentKind.Supported],
            ['99214', CodeAssessmentKind.NotAssessed],
          ],
        }
      )
    );

    expect(screen.getByTestId('coding-defense-supported')).toHaveTextContent('Documentation supports 29125');
    expect(screen.getByTestId('coding-defense-findings')).toHaveTextContent('Splint material is not documented.');
    expect(screen.getByTestId('coding-defense-not-assessed')).toHaveTextContent(
      '99214 — not assessed by documentation checks'
    );
  });

  it('adds a compound suggestion with add-on units and stays actionable until units match', async () => {
    const user = userEvent.setup();
    const suggestion = evaluation({
      kind: CodeOutcomeKind.Determined,
      suggestion: {
        code: '13132',
        display: 'Complex repair, initial length',
        justification: 'Complex repair documented.',
        addOns: [
          {
            code: '13133',
            units: 2,
            display: 'Each additional 5 cm',
            justification: 'Additional documented length.',
          },
        ],
      },
    });
    const { onAddCodes } = renderAssistance(suggestion, noDefense(), [
      { code: '13132', display: 'Complex repair, initial length' },
      { code: '13133', display: 'Each additional 5 cm', billableUnits: 1 },
    ]);

    const addButton = screen.getByTestId('cpt-code-quick-add-13132');
    await user.click(addButton);
    expect(onAddCodes).toHaveBeenCalledWith([
      expect.objectContaining({ code: '13132' }),
      expect.objectContaining({ code: '13133', billableUnits: 2 }),
    ]);
  });
});

describe('conditional coding fields', () => {
  const handlers = {
    onLengthChange: vi.fn(),
    onRepairDepthChange: vi.fn(),
    onInfusionStartChange: vi.fn(),
    onInfusionStopChange: vi.fn(),
  };

  const renderFields = (children: ReactNode): ReturnType<typeof render> => render(<>{children}</>);

  it('renders and clears a saved repair depth', async () => {
    const user = userEvent.setup();
    renderFields(
      <ConditionalCodingFields
        visibility={{ length: true, repairDepth: true, infusionTimes: false }}
        isReadOnly={false}
        lengthCm={3.2}
        repairDepth="subcutaneous-layered"
        {...handlers}
      />
    );

    expect(screen.getByTestId('length-cm-input').querySelector('input')).toHaveValue(3.2);
    expect(screen.getByTestId('repair-depth-select')).toHaveTextContent('Subcutaneous — layered closure');
    await user.click(screen.getByRole('button', { name: 'Clear Repair depth' }));
    expect(handlers.onRepairDepthChange).toHaveBeenCalledWith(undefined);
  });

  it('keeps invalid wound input visible while excluding it from structured state', async () => {
    const user = userEvent.setup();
    renderFields(
      <ConditionalCodingFields
        visibility={{ length: true, repairDepth: false, infusionTimes: false }}
        isReadOnly={false}
        {...handlers}
      />
    );

    const input = screen.getByTestId('length-cm-input').querySelector('input') as HTMLInputElement;
    await user.type(input, '0');
    expect(input).toHaveValue(0);
    expect(screen.getByText(/between 0.1 and 100 cm/i)).toBeVisible();
    expect(handlers.onLengthChange).toHaveBeenCalledWith(undefined);
  });

  it('renders infusion duration and validation', () => {
    const { rerender } = renderFields(
      <ConditionalCodingFields
        visibility={{ length: false, repairDepth: false, infusionTimes: true }}
        isReadOnly={false}
        infusionStartTime="13:00"
        infusionStopTime="13:42"
        {...handlers}
      />
    );

    expect(screen.getByTestId('infusion-start-time-input')).toHaveValue('13:00');
    expect(screen.getByTestId('infusion-stop-time-input')).toHaveValue('13:42');
    expect(screen.getByTestId('infusion-duration-caption')).toHaveTextContent('42 min');

    rerender(
      <ConditionalCodingFields
        visibility={{ length: false, repairDepth: false, infusionTimes: true }}
        isReadOnly={false}
        infusionStartTime="14:30"
        infusionStopTime="14:00"
        {...handlers}
      />
    );
    expect(screen.getByTestId('infusion-stop-time-input').parentElement).toHaveTextContent(
      'Check these times — the span is 1410 minutes'
    );
  });
});

describe('procedure form selections', () => {
  it('does not add a CPT code that is already selected', async () => {
    const user = userEvent.setup();
    const selectedCode = { code: '12042', display: 'Intermediate repair' };
    const onAdd = vi.fn();
    render(
      <ProcedureCptCodesField
        codes={[selectedCode]}
        searchOptions={[selectedCode]}
        isSearching={false}
        searchTerm="12042"
        onSearchTermChange={vi.fn()}
        onAdd={onAdd}
        onDelete={vi.fn()}
        disabled={false}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'CPT code' }));
    expect(await screen.findByRole('option', { name: '12042 Intermediate repair' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('matches multi-select values by value and allows deselection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProcedureMultiSelect
        label="Technique"
        options={['Curette']}
        values={['Curette']}
        onChange={onChange}
        disabled={false}
        dataTestId="technique"
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Technique' }));
    await user.click(await screen.findByRole('option', { name: 'Curette' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('clears an optional selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProcedureDropdown
        label="Site/location"
        options={['Hand']}
        value="Hand"
        onChange={onChange}
        disabled={false}
        dataTestId="site"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear Site/location' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
