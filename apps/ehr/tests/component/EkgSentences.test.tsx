import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, useState } from 'react';
import { ekgFamily } from 'utils/lib/procedure-coding/families/ekg';
import { resolveFamilyFacts } from 'utils/lib/procedure-coding/family-support';
import { StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { describe, expect, it } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { EkgSentences } from '../../src/features/visits/in-person/components/procedures/narrative/EkgSentences';

const latest: { facts?: StructuredFacts } = {};

function Form({
  initial = {},
  readOnly = false,
  isChild = false,
}: {
  initial?: StructuredFacts;
  readOnly?: boolean;
  isChild?: boolean;
}): ReactElement {
  const [value, setValue] = useState<StructuredFacts>(resolveFamilyFacts(ekgFamily, { structuredFacts: initial }));
  latest.facts = value;
  return <EkgSentences family={ekgFamily} value={value} onChange={setValue} readOnly={readOnly} isChild={isChild} />;
}

const tile = (key: string): HTMLElement => screen.getByTestId(dataTestIds.documentProcedurePage.ekgTile(key));
const typeNumbers = async (
  user: ReturnType<typeof userEvent.setup>,
  numbers: Record<string, number>
): Promise<void> => {
  for (const [name, value] of Object.entries(numbers)) {
    const input = screen.getByRole('spinbutton', { name });
    await user.clear(input);
    await user.type(input, String(value));
  }
};

describe('EKG sentences', () => {
  it('shows six plain measurement tiles after the billing sentence and the interpretation blanks after them', () => {
    render(<Form />);
    expect(screen.getByText(/Component furnished:/)).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(7); // the count blank and six tiles
    for (const key of ['rate', 'pr', 'qrs', 'qt', 'qtc', 'axisDegrees']) expect(tile(key)).toBeInTheDocument();
    expect(within(tile('qtc')).getByText('Bazett')).toBeInTheDocument();
    // Interpretation blanks in reading order, "other findings" optional (grey), the rest needed (orange).
    expect(screen.getByRole('button', { name: 'rhythm (empty)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'intervals and conduction (empty)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'other findings (empty)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'impression (empty)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^\+ other findings/ })).not.toBeInTheDocument();
  });

  it('calculates QTc with Bazett from QT and rate, Fridericia on F, and keeps a typed value as manual', async () => {
    const user = userEvent.setup();
    render(<Form />);
    await typeNumbers(user, { 'Rate (bpm)': 72, 'QT (ms)': 380 });
    const qtc = screen.getByRole('spinbutton', { name: 'QTc (ms)' });
    expect(qtc).toHaveValue(416);
    expect(latest.facts).toMatchObject({ rate: 72, qt: 380, qtc: 416, qtcMethod: 'Bazett' });

    await user.click(screen.getByRole('button', { name: 'Fridericia' }));
    expect(qtc).toHaveValue(404);
    expect(within(tile('qtc')).getByText('Fridericia')).toBeInTheDocument();
    expect(latest.facts).toMatchObject({ qtc: 404, qtcMethod: 'Fridericia' });

    await user.clear(qtc);
    await user.type(qtc, '430');
    expect(within(tile('qtc')).getByText('manual')).toBeInTheDocument();
    expect(latest.facts).toMatchObject({ qtc: 430, qtcMethod: 'manual' });
    // A manual value stays put when the inputs change; Bazett recalculates from them again.
    await typeNumbers(user, { 'Rate (bpm)': 80 });
    expect(qtc).toHaveValue(430);
    await user.click(screen.getByRole('button', { name: 'Bazett' }));
    expect(qtc).toHaveValue(439);
  });

  it('keeps the intervals list open while ticking, with "normal" standing alone', async () => {
    const user = userEvent.setup();
    render(<Form />);
    await user.click(screen.getByRole('button', { name: 'intervals and conduction (empty)' }));
    await user.click(screen.getByRole('checkbox', { name: 'first-degree AV block' }));
    expect(screen.getByRole('checkbox', { name: 'prolonged QTc' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'prolonged QTc' }));
    expect(latest.facts?.conduction).toEqual(['first-degree AV block', 'prolonged QTc']);
    await user.click(screen.getByRole('checkbox', { name: 'normal' }));
    expect(latest.facts?.conduction).toEqual(['normal']);
    await user.click(screen.getByRole('checkbox', { name: 'right bundle branch block' }));
    expect(latest.facts?.conduction).toEqual(['right bundle branch block']);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'intervals and conduction: right bundle branch block' })
    ).toBeInTheDocument();
  });

  it('offers the impression scale in its own order and the measurements as plain text when read-only', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Form />);
    await user.click(screen.getByRole('button', { name: 'impression (empty)' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'normal ECG',
      'otherwise normal ECG',
      'borderline ECG',
      'abnormal ECG',
    ]);
    unmount();

    render(<Form initial={{ rate: 72, qt: 380, qtc: 416, qtcMethod: 'Bazett' }} readOnly />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(within(tile('qtc')).getByText('416')).toBeInTheDocument();
    expect(within(tile('qtc')).getByText('Bazett')).toBeInTheDocument();
    expect(within(tile('pr')).getByText('—')).toBeInTheDocument();
  });
});
