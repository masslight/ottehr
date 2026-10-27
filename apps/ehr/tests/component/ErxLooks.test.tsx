import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DoseCalculatorCard } from '../../src/features/visits/in-person/components/erx-looks/DoseCalculatorCard';
import { ErxSuggestionsBox } from '../../src/features/visits/in-person/components/erx-looks/ErxSuggestionsBox';
import {
  CALCULATOR_LOOKS,
  SUGGESTION_LOOKS,
} from '../../src/features/visits/in-person/components/erx-looks/sampleLooks';

const suggestionLook = (title: string): (typeof SUGGESTION_LOOKS)[number]['props'] =>
  SUGGESTION_LOOKS.find((look) => look.title === title)!.props;
const calculatorLook = (tag: string): (typeof CALCULATOR_LOOKS)[number]['props'] =>
  CALCULATOR_LOOKS.find((look) => look.tag === tag)!.props;

describe('eRx suggestion looks', () => {
  it.each([
    ['Dosed row', /^Because 28.12 kg × 25 mg\/kg\/day/],
    ['Label chart row', 'Because the OTC Drug Facts chart, 60–71 lb'],
    ['Row with no amount', 'Take by mouth three times daily (see the dose calculator).'],
    ['Needs a weight', 'Take by mouth twice daily (dose by weight).'],
    ['Limit instead of a dose', 'Inject into the outer thigh once — 30 kg and up.'],
  ])('%s', (title, text) => {
    render(<ErxSuggestionsBox {...suggestionLook(title)} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ }).at(-1)
    ).toHaveAccessibleName('Write my own');
  });

  it('shows a diagnosis blank empty or filled', () => {
    render(<ErxSuggestionsBox {...suggestionLook('Dosed row for a diagnosis')} />);
    expect(screen.getByRole('button', { name: 'Acute otitis media: not picked' })).toHaveTextContent(
      'acute otitis media'
    );
    expect(
      screen.getByRole('button', { name: 'Croup: Acute obstructive laryngitis [croup] J05.0' })
    ).toBeInTheDocument();
  });

  it('shows the weight note, caution and note lines', () => {
    render(<ErxSuggestionsBox {...suggestionLook('Cautions, notes and the weight note')} />);
    expect(screen.getByText('using weight 18 kg (previous visit, 10/8/2026)')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-caution')).toHaveTextContent(/^Caution: GINA 2026/);
    expect(screen.getByTestId('suggestion-note')).toHaveTextContent(/^Note: PDR/);
  });

  it('offers only "Other" with no rows, and calls back on it', async () => {
    const onOther = vi.fn();
    render(<ErxSuggestionsBox look="rows" rows={[]} onPick={vi.fn()} onOther={onOther} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Write my own' }));
    expect(onOther).toHaveBeenCalledTimes(1);
  });

  it('renders no box, or a red alert and no rows', () => {
    const { container, unmount } = render(<ErxSuggestionsBox {...suggestionLook('No box at all')} />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    render(<ErxSuggestionsBox {...suggestionLook('No rows, red warning')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Promethazine is contraindicated/);
    expect(screen.queryByRole('button', { name: 'Write my own' })).not.toBeInTheDocument();
  });
});

describe('dose calculator looks', () => {
  it('by weight: the inputs grid, result, source and "Use this dose"', async () => {
    const props = calculatorLook('Calc 1');
    const onUse = vi.fn();
    render(<DoseCalculatorCard {...props} onUse={onUse} />);
    expect(screen.getByRole('button', { name: 'regimen: AAP high-dose (acute otitis media)' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'weight' })).toHaveValue(28.12);
    expect(screen.getByText('(low end of the range 80–90 mg/kg/day)')).toBeInTheDocument();
    expect(screen.getByTestId('dose-result')).toHaveTextContent('14 mLtwice daily');
    expect(screen.getByTestId('dose-sources')).toHaveTextContent('Source: AAP EQIPP dosage table · max 2 g/dose');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('passes typed values out by field', async () => {
    const onFieldChange = vi.fn();
    render(<DoseCalculatorCard {...calculatorLook('Calc 6')} onFieldChange={onFieldChange} />);
    await userEvent.setup().type(screen.getByRole('spinbutton', { name: 'rate' }), '1');
    expect(onFieldChange).toHaveBeenCalledWith('rate', '1');
  });

  it.each([
    ['Calc 2', '60–71 lb, 9–10 years: 12.5 mL every 6 to 8 hours as needed', true],
    ['Calc 3', '500 mg → 2 tablets = 500 mg (250 mg/tablet)', true],
    ['Calc 4', 'Days 2–5: 3.5 mL once daily (5 mg/kg)', true],
    ['Calc 5', '… down to day 6: 1 tablet', false],
    ['Calc 6', 'Enter a rate (range 0.14–2 mg/kg/day) to work out the dose', false],
    ['Calc 7', "No dose: the label's minimum", false],
    ['Calc 8', '3 capsules = 750 mg, 47 mg (7%) over 703 mg', true],
  ])('%s', (tag, text, usable) => {
    render(<DoseCalculatorCard {...calculatorLook(tag)} />);
    expect(screen.getByTestId('dose-calculator')).toHaveTextContent(text);
    expect(screen.queryByRole('button', { name: 'Use this dose' }) !== null).toBe(usable);
  });

  it('shows red and orange warning boxes', () => {
    render(<DoseCalculatorCard {...calculatorLook('Overlay')} />);
    expect(screen.getByTestId('dose-warnings-error')).toHaveTextContent('Contraindicated: in the label’s words.');
    expect(screen.getByTestId('dose-warnings-warning')).toHaveTextContent('Picked by hand for a patient outside it.');
  });
});
