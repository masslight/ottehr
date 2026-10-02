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

  it('suggests reads ranked for the numbers, lets a highlighted word change, and fills the fields on ⊕', async () => {
    const user = userEvent.setup();
    render(<Form initial={{ rate: 64, pr: 236, qrs: 92, qt: 410 }} />);
    const box = screen.getByTestId(dataTestIds.documentProcedurePage.ekgSuggestions);
    expect(within(box).getByText('Because PR 236 ms is over 200')).toBeInTheDocument();
    const useButtons = within(box).getAllByRole('button', { name: 'Use this interpretation' });
    expect(useButtons).toHaveLength(3);

    await user.click(useButtons[0]);
    expect(latest.facts).toMatchObject({
      rhythm: 'sinus rhythm',
      conduction: ['first-degree AV block'],
      stt: ['no acute ST-T wave changes'],
      impression: 'borderline ECG',
    });
    expect(screen.getByRole('button', { name: 'impression: borderline ECG' })).toBeInTheDocument();
    expect(within(box).getAllByRole('img', { name: 'Added to interpretation' })).toHaveLength(1);

    // Changing a highlighted word re-arms the row; the fields are only touched on ⊕.
    await user.click(within(box).getAllByRole('button', { name: 'Impression: borderline ECG' })[0]);
    await user.click(screen.getByRole('option', { name: 'abnormal ECG' }));
    expect(within(box).queryByRole('img', { name: 'Added to interpretation' })).not.toBeInTheDocument();
    expect(latest.facts?.impression).toBe('borderline ECG');
    await user.click(within(box).getAllByRole('button', { name: 'Use this interpretation' })[0]);
    expect(latest.facts?.impression).toBe('abnormal ECG');
    // Editing the interpretation by hand re-arms the row too.
    await user.click(screen.getByRole('button', { name: 'rhythm: sinus rhythm' }));
    await user.click(screen.getByRole('option', { name: 'sinus arrhythmia' }));
    expect(within(box).queryByRole('img', { name: 'Added to interpretation' })).not.toBeInTheDocument();
  });

  it('waits for the rate and QT, and offers a child only the normal read with no reminders', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Form />);
    const box = screen.getByTestId(dataTestIds.documentProcedurePage.ekgSuggestions);
    expect(within(box).getByText('enter the rate and QT to see suggestions')).toBeInTheDocument();
    expect(within(box).queryByRole('button', { name: 'Use this interpretation' })).not.toBeInTheDocument();
    await typeNumbers(user, { 'Rate (bpm)': 72, 'QT (ms)': 380 });
    expect(within(box).getAllByRole('button', { name: 'Use this interpretation' })).toHaveLength(2);
    unmount();

    render(
      <Form initial={{ rate: 118, pr: 236, qt: 410, conduction: ['normal'], impression: 'normal ECG' }} isChild />
    );
    const childBox = screen.getByTestId(dataTestIds.documentProcedurePage.ekgSuggestions);
    expect(within(childBox).getAllByRole('button', { name: 'Use this interpretation' })).toHaveLength(1);
    expect(within(childBox).getByText(/Patient is under 18/)).toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.documentProcedurePage.ekgReminders)).not.toBeInTheDocument();
  });

  it('reminds an adult when the interpretation contradicts the numbers, with one-click fixes', async () => {
    const user = userEvent.setup();
    render(
      <Form initial={{ rate: 64, pr: 236, qrs: 92, qt: 410, conduction: ['normal'], impression: 'normal ECG' }} />
    );
    const box = screen.getByTestId(dataTestIds.documentProcedurePage.ekgReminders);
    expect(within(box).getByText(/A PR of 236 ms meets the definition of first-degree AV block/)).toBeInTheDocument();
    expect(within(box).getByText(/this is a reminder, not a block/)).toBeInTheDocument();

    await user.click(within(box).getByRole('button', { name: 'Add first-degree AV block' }));
    expect(latest.facts?.conduction).toEqual(['first-degree AV block']);
    expect(within(box).queryByText(/A PR of 236 ms/)).not.toBeInTheDocument();
    await user.click(within(box).getByRole('button', { name: 'Change impression' }));
    expect(latest.facts?.impression).toBe('borderline ECG');
    expect(screen.queryByTestId(dataTestIds.documentProcedurePage.ekgReminders)).not.toBeInTheDocument();
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
