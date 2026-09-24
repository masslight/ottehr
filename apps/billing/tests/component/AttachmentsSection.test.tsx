import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentsSection } from '../../src/components/attachments/AttachmentsSection';

const REPORT_TYPES = [
  { code: 'OZ', label: 'Support Data for Claim' },
  { code: 'RR', label: 'Radiology Reports' },
];

const attachments = [{ id: 'doc-1', fileName: 'Remit.pdf', dateAdded: '2026-09-13T15:00:00Z', reportTypeCode: 'RR' }];

const handlers = (): {
  onUpload: ReturnType<typeof vi.fn>;
  onRename: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  onDownload: ReturnType<typeof vi.fn>;
} => ({
  onUpload: vi.fn().mockResolvedValue(undefined),
  onRename: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onDownload: vi.fn().mockResolvedValue(undefined),
});

const dropFile = async (file: File): Promise<void> => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText(file.name, { selector: '.MuiListItemText-primary' });
};

describe('AttachmentsSection', () => {
  it('names an upload after the dropped file and passes the report type', async () => {
    const actions = handlers();
    render(
      <AttachmentsSection attachments={[]} reportTypeCodes={REPORT_TYPES} defaultReportTypeCode="OZ" {...actions} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const file = new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' });
    await dropFile(file);
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText(/Name/)).toHaveValue('scan.pdf');
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(actions.onUpload).toHaveBeenCalledWith({ name: 'scan.pdf', file, reportTypeCode: 'OZ' })
    );
  });

  it('shows why an upload failed and keeps the dialog open', async () => {
    const actions = handlers();
    actions.onUpload.mockRejectedValueOnce(new Error('The file could not be uploaded (403)'));
    render(<AttachmentsSection attachments={[]} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await dropFile(new File(['x'], 'scan.png', { type: 'image/png' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The file could not be uploaded (403)')).toBeInTheDocument();
    // attachments without report types have no picker
    expect(screen.queryByLabelText('Report Type Code')).not.toBeInTheDocument();
  });

  it('renames with its own form, pre-filled with the current name', async () => {
    const actions = handlers();
    render(<AttachmentsSection attachments={attachments} reportTypeCodes={REPORT_TYPES} {...actions} />);
    expect(screen.getByText('RR — Radiology Reports')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByText('Rename document'));
    const dialog = within(await screen.findByRole('dialog'));
    const name = dialog.getByLabelText(/Name/);
    expect(name).toHaveValue('Remit.pdf');
    fireEvent.change(name, { target: { value: 'UHC remit.pdf' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(actions.onRename).toHaveBeenCalledWith('doc-1', 'UHC remit.pdf'));
  });

  it('deletes after confirmation and downloads', async () => {
    const actions = handlers();
    render(<AttachmentsSection attachments={attachments} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(actions.onDownload).toHaveBeenCalledWith('doc-1');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByText('Delete document'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(actions.onDelete).toHaveBeenCalledWith('doc-1'));
  });

  it('offers only downloads when read-only, and explains a disabled add', () => {
    const readOnly = handlers();
    const { unmount } = render(<AttachmentsSection attachments={attachments} readOnly {...readOnly} />);
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
    unmount();

    render(
      <AttachmentsSection
        attachments={[]}
        description="Attach a scan of the paper remit (PDF or image)."
        disabledReason="Save the remit details first"
        {...handlers()}
      />
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByText('Attach a scan of the paper remit (PDF or image).')).toBeInTheDocument();
    expect(screen.queryByText('No attachments')).not.toBeInTheDocument();
  });
});
