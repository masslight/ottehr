import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { PrescriptionSentences } from '../../src/features/visits/in-person/components/erx/PrescriptionSentences';

// The searches behind the medication and diagnosis popovers are network calls; these tests never open them.
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: [], isFetching: false }),
}));
vi.mock('../../src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [], isFetching: false }),
}));

const AMOXICILLIN = { ndc: '00093310901', description: 'Amoxicillin 500 MG Oral Capsule' };

const Harness = ({ initial, onRemove }: { initial: PrescriptionLine; onRemove?: () => void }): JSX.Element => {
  const [line, setLine] = useState(initial);
  return (
    <PrescriptionSentences
      line={line}
      index={0}
      onChange={setLine}
      onRemove={onRemove}
      quickPicks={[]}
      onQuickPick={() => undefined}
      visitDiagnoses={[]}
      errors={[]}
      readOnly={false}
    />
  );
};

describe('PrescriptionSentences', () => {
  it('numbers the line and waits for a medication before suggesting anything', () => {
    render(<Harness initial={emptyPrescriptionLine()} />);
    expect(screen.getByText('Prescription 1:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'medication (empty)' })).toBeInTheDocument();
    expect(screen.getByText('pick a medication to see suggestions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this prescription' })).not.toBeInTheDocument();
  });

  it('fills the dispense details and directions from a suggestion, then shows it in use', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyPrescriptionLine(), medication: AMOXICILLIN }} />);

    const [scheduled] = screen.getAllByRole('button', { name: 'Use this prescription' });
    await user.click(scheduled);

    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 1 capsule by mouth twice daily for 10 days.'
    );
    expect(screen.getByRole('spinbutton', { name: 'quantity' })).toHaveValue(20);
    expect(screen.getByRole('spinbutton', { name: 'days supply' })).toHaveValue(10);
    expect(screen.getByRole('button', { name: 'unit: capsules' })).toBeInTheDocument();
    expect(screen.getByTitle('In use')).toBeInTheDocument();
  });

  it('re-arms the suggestion once a filled field is edited', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyPrescriptionLine(), medication: AMOXICILLIN }} />);
    await user.click(screen.getAllByRole('button', { name: 'Use this prescription' })[0]);

    const quantity = screen.getByRole('spinbutton', { name: 'quantity' });
    await user.clear(quantity);
    await user.type(quantity, '30');

    expect(screen.queryByTitle('In use')).not.toBeInTheDocument();
  });

  it('offers removal only when the page passes a remove handler', () => {
    const { unmount } = render(<Harness initial={emptyPrescriptionLine()} />);
    expect(screen.queryByRole('button', { name: 'Remove prescription 1' })).not.toBeInTheDocument();
    unmount();

    render(<Harness initial={emptyPrescriptionLine()} onRemove={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Remove prescription 1' })).toBeInTheDocument();
  });
});
