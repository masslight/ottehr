import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualEraClaimDialog } from '../../src/components/era/ManualEraClaimDialog';
import { ClaimForm, emptyClaimForm } from '../../src/utils/manualEra';

// MUI's pickers and the terminology-backed CPT search don't run under jsdom; plain inputs stand in.
vi.mock('../../src/components/DateInput', async () => ({ DateInput: (await import('./inputStub')).InputStub }));
vi.mock('../../src/components/ProcedureCodeAutocomplete', async () => ({
  ProcedureCodeAutocomplete: (await import('./inputStub')).InputStub,
}));

const type = (label: string | RegExp, value: string, index = 0): void => {
  fireEvent.change(screen.getAllByLabelText(label)[index], { target: { value } });
};
const values = (label: string): string[] =>
  screen.getAllByLabelText(label).map((input) => (input as HTMLInputElement).value);

describe('ManualEraClaimDialog', () => {
  const onAdd = vi.fn();
  beforeEach(() => {
    onAdd.mockReset().mockResolvedValue(undefined);
    // jsdom doesn't implement scrollIntoView, which taking the biller to an error calls
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('builds the CARCs from the amounts and adds the claim to the remit', async () => {
    render(<ManualEraClaimDialog initialClaim={emptyClaimForm()} onCancel={vi.fn()} onAdd={onAdd} />);

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

    fireEvent.click(screen.getByRole('button', { name: 'Add to Remit' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    const added = onAdd.mock.calls[0][0] as ClaimForm;
    expect(added.patientName).toBe('Joe Schmoe');
    expect(added.serviceLines[0].adjustments.map((row) => `${row.groupCode}-${row.reasonCode} ${row.amount}`)).toEqual([
      'CO-45 50',
      'PR-3 25',
      'PR-1 25',
    ]);
  });

  it('marks what is missing on the fields themselves and takes the biller to the first', async () => {
    render(<ManualEraClaimDialog initialClaim={emptyClaimForm()} onCancel={vi.fn()} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Remit' }));

    const patientName = screen.getByRole('textbox', { name: /Patient Name/ });
    await waitFor(() => expect(patientName).toHaveFocus());
    expect(patientName).toHaveAccessibleDescription('Required');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    // and the line's date of service, procedure code, billed and paid amounts
    expect(screen.getAllByText('Required')).toHaveLength(5);
    expect(onAdd).not.toHaveBeenCalled();

    // from here on the errors follow the edits
    type(/Patient Name/, 'Joe Schmoe');
    await waitFor(() => expect(screen.getAllByText('Required')).toHaveLength(4));
    expect(patientName).not.toHaveAccessibleDescription('Required');
  });

  it('flags each part of a CARC left incomplete', async () => {
    render(
      <ManualEraClaimDialog
        initialClaim={emptyClaimForm({ patientName: 'Joe', serviceDate: '2026-08-15' })}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );
    type('CPT/HCPCS', '99212');
    type('Billed', '100');
    type('Ins Paid', '100');
    fireEvent.click(screen.getByRole('button', { name: 'CARC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Remit' }));

    // the group, the code and the amount
    await waitFor(() => expect(screen.getAllByText('Required')).toHaveLength(3));
    expect(screen.getByRole('combobox', { name: /^Group/ })).toHaveFocus();
    expect(onAdd).not.toHaveBeenCalled();
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
