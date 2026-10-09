import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EraClaimEditor } from '../../src/components/era/EraClaimEditor';
import { emptyClaimForm } from '../../src/utils/manualEra';

// MUI's pickers and the terminology-backed CPT search don't run under jsdom; plain inputs stand in.
vi.mock('../../src/components/DateInput', async () => ({ DateInput: (await import('./inputStub')).InputStub }));
vi.mock('../../src/components/ProcedureCodeAutocomplete', async () => ({
  ProcedureCodeAutocomplete: (await import('./inputStub')).InputStub,
}));

function Editor(): ReactElement {
  const [claim, setClaim] = useState(emptyClaimForm);
  return <EraClaimEditor claim={claim} onChange={setClaim} />;
}

const type = (label: string | RegExp, value: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const values = (label: string): string[] =>
  screen.getAllByLabelText(label).map((input) => (input as HTMLInputElement).value);

describe('EraClaimEditor', () => {
  it('builds the CARCs from the amounts', () => {
    render(<Editor />);

    type('Service Date', '2026-08-15');
    // the claim's service date becomes the line's date of service
    expect(values('DOS')).toEqual(['2026-08-15']);

    type('Billed', '150');
    type('Allowed', '100');
    // billed − allowed becomes a CO-45 adjustment
    expect(values('CARC')).toEqual(['45']);
    expect(values('Amount')).toEqual(['50']);

    type('Ins Paid', '50');
    type('Co-Pay', '25');
    type('Deductible', '25');
    expect(values('CARC')).toEqual(['45', '3', '1']);
    expect(values('Amount')).toEqual(['50', '25', '25']);
  });

  it('lets the biller take over a generated CARC', () => {
    render(<Editor />);
    type('Billed', '150');
    type('Allowed', '100');
    type('Amount', '40');
    type('Allowed', '90');
    // edited by hand, the row no longer follows billed − allowed
    expect(values('Amount')).toEqual(['40']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove CO-45' }));
    type('Allowed', '80');
    expect(screen.queryAllByLabelText('CARC')).toHaveLength(0);
  });
});
