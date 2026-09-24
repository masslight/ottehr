import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualEraClaimDialog } from '../../src/components/era/ManualEraClaimDialog';
import { ClaimForm, emptyClaimForm } from '../../src/utils/manualEra';

// MUI's pickers and the terminology-backed CPT search don't run under jsdom; plain inputs stand in.
vi.mock('../../src/components/DateInput', () => ({
  DateInput: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock('../../src/components/ProcedureCodeAutocomplete', () => ({
  ProcedureCodeAutocomplete: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />,
}));

const type = (label: string | RegExp, value: string, index = 0): void => {
  fireEvent.change(screen.getAllByLabelText(label)[index], { target: { value } });
};
const values = (label: string): string[] =>
  screen.getAllByLabelText(label).map((input) => (input as HTMLInputElement).value);

describe('ManualEraClaimDialog', () => {
  const onAdd = vi.fn();
  beforeEach(() => onAdd.mockReset().mockResolvedValue(undefined));

  it('builds the CARCs from the amounts and adds the claim to the remit', async () => {
    render(<ManualEraClaimDialog initialClaim={emptyClaimForm()} onCancel={vi.fn()} onAdd={onAdd} />);
    const addButton = screen.getByRole('button', { name: 'Add to Remit' });
    expect(addButton).toBeDisabled();

    type(/Patient Name/, 'Joe Schmoe');
    type('Service Date', '2026-08-15');
    // the claim's service date becomes the line's date of service
    expect(values('DOS')).toEqual(['2026-08-15']);

    type('CPT/HCPCS', '99212');
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

    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    const added = onAdd.mock.calls[0][0] as ClaimForm;
    expect(added.patientName).toBe('Joe Schmoe');
    expect(added.serviceLines[0].adjustments.map((row) => `${row.groupCode}-${row.reasonCode} ${row.amount}`)).toEqual([
      'CO-45 50',
      'PR-3 25',
      'PR-1 25',
    ]);
  });

  it('lets the biller take over a generated CARC', () => {
    render(<ManualEraClaimDialog initialClaim={emptyClaimForm()} onCancel={vi.fn()} onAdd={onAdd} />);
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

  it('keeps the dialog open with the error when saving fails', async () => {
    onAdd.mockRejectedValueOnce(new Error('The remit changed'));
    render(
      <ManualEraClaimDialog
        initialClaim={emptyClaimForm({
          patientName: 'Joe',
          serviceDate: '2026-08-15',
        })}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );
    type('CPT/HCPCS', '99212');
    type('Billed', '100');
    type('Ins Paid', '100');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Remit' }));
    expect(await screen.findByText('The remit changed')).toBeInTheDocument();
  });

  it('says a pre-filled claim is added matched', () => {
    render(
      <ManualEraClaimDialog
        initialClaim={emptyClaimForm({ matchedClaimId: 'claim-9', patientName: 'Schmoe, Joe' })}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );
    expect(screen.getByText(/added to the remit matched to claim claim-9/)).toBeInTheDocument();
  });
});
