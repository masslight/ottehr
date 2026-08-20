import { render, screen } from '@testing-library/react';
import { FaxDocumentAvailability } from 'utils/lib/types/api/fax.types';
import { describe, expect, it, vi } from 'vitest';
import { SendFaxForm } from '../../src/features/fax/ui/SendFaxForm';

const documents: FaxDocumentAvailability[] = [
  { kind: 'progress-note', available: true },
  { kind: 'discharge-summary', available: false },
  { kind: 'lab-results', available: false },
  { kind: 'radiology-results', available: false },
  { kind: 'patient-education', available: false },
];

const renderForm = (
  preview?: { documents: FaxDocumentAvailability[]; hasSavedPcp: boolean },
  senderFaxNumber?: string
): void => {
  render(
    <SendFaxForm
      preview={preview}
      senderFaxNumber={senderFaxNumber}
      isSending={false}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
    />
  );
};

describe('SendFaxForm PCP control', () => {
  it('omits PCP management from patient-level fax dialogs', () => {
    renderForm();

    expect(screen.queryByRole('checkbox', { name: "Save as patient's PCP" })).toBeNull();
  });

  it('preserves PCP management for the original single-visit dialog', () => {
    renderForm({ documents, hasSavedPcp: false });

    expect(screen.getByRole('checkbox', { name: "Save as patient's PCP" })).toBeChecked();
  });
});

describe('SendFaxForm sender', () => {
  it('names the number the fax is sent from, formatted for reading', () => {
    renderForm(undefined, '+12125550000');

    expect(screen.getByText('Sender fax number: (212) 555-0000')).toBeVisible();
  });

  it('leaves the sender out when the sending number cannot be resolved', () => {
    renderForm({ documents, hasSavedPcp: false });

    expect(screen.queryByText(/Sender fax number/)).toBeNull();
  });

  it("labels the recipient's own number so the two cannot be confused", () => {
    renderForm(undefined, '+12125550000');

    expect(screen.getByLabelText(/Recipient Fax/)).toBeVisible();
  });
});
