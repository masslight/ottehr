import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Task } from 'fhir/r4b';
import { InvoiceablePatientReport } from 'utils/lib/types/api/invoicing.types';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/components/template-editor-field/TemplateEditorField', () => ({
  textToTiptapContent: (text: string) => text,
  TemplateEditorField: (props: any) => (
    <div>
      <textarea aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.helperText && <div>{props.helperText}</div>}
    </div>
  ),
}));

vi.mock('src/components/form/DatePicker', () => ({ BasicDatePicker: () => null }));

vi.mock('src/rcm/state/invoice-config/invoice-config.queries', () => ({
  useGetInvoiceConfigQuery: () => ({ data: undefined }),
}));

import SendInvoiceToPatientDialog from '../../src/components/dialogs/SendInvoiceToPatientDialog';

const task: Task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'ready',
  intent: 'order',
  input: [
    {
      type: { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/invoice-task-input', code: 'amountCents' }] },
      valueString: '2500',
    },
  ],
};

const report = {
  claimId: 'claim-1',
  finalizationDateISO: '2030-01-01',
  amountInvoiceable: 25,
  task,
  visitDate: '2029-12-01',
  location: 'Main',
  patient: { patientId: 'p-1', fullName: 'Jane Doe', phoneNumber: '5555555555' },
  responsibleParty: { fullName: 'Jane Doe', email: 'jane@example.com' },
} as InvoiceablePatientReport;

const renderDialog = (onSubmit = vi.fn().mockResolvedValue(undefined)): typeof onSubmit => {
  render(
    <SendInvoiceToPatientDialog
      title="Send invoice"
      modalOpen
      handleClose={vi.fn()}
      onSubmit={onSubmit}
      submitButtonName="Send"
      report={report}
    />
  );
  return onSubmit;
};

describe('SendInvoiceToPatientDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['Invoice memo', 'SMS message'])('does not submit when %s is only whitespace', async (label) => {
    const onSubmit = renderDialog();
    const field = await screen.findByLabelText(label);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());

    fireEvent.change(field, { target: { value: '  \n ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(REQUIRED_FIELD_ERROR_MESSAGE)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits memo and SMS text as typed when they are not blank', async () => {
    const onSubmit = renderDialog();
    const memo = await screen.findByLabelText('Invoice memo');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());

    fireEvent.change(memo, { target: { value: 'Thanks for visiting ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toBe('task-1');
    expect(onSubmit.mock.calls[0][1]).toMatchObject({ memo: 'Thanks for visiting ', amountCents: 2500 });
  });
});
