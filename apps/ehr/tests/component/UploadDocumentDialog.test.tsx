/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpload, mockCapture } = vi.hoisted(() => ({ mockUpload: vi.fn(), mockCapture: vi.fn() }));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('utils/lib/frontend/sentry', () => ({ safelyCaptureException: mockCapture }));
// Stands in for the scanner: a button that finishes a scan with one PDF named "scan 1".
vi.mock('src/components/ScannerModal', () => ({
  ScannerModal: ({ open, onScanComplete }: { open: boolean; onScanComplete: (blob: Blob, name: string) => void }) =>
    open ? (
      <button type="button" onClick={() => onScanComplete(new Blob(['%PDF']), 'scan 1')}>
        Finish scan
      </button>
    ) : null,
}));
vi.mock('src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocsFolders: () => ({ data: {} }),
  parsePatientDocsFolders: () => [
    { id: 'labs-id', folderName: 'Labs', internalName: 'labs', documentsCount: 0, isCustom: false },
    { id: 'imaging-id', folderName: 'Imaging', internalName: 'imaging', documentsCount: 0, isCustom: false },
  ],
  usePatientDocsActions: () => ({ uploadDocumentAction: mockUpload, isUploading: false }),
}));

import { UploadDocumentDialog } from '../../src/features/visits/shared/components/patient/docs/UploadDocumentDialog';

const pdf = (name: string): File => new File(['%PDF'], name, { type: 'application/pdf' });

describe('UploadDocumentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({});
  });

  it('starts in the folder the user is in and uploads the chosen file there', async () => {
    const onUploaded = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <UploadDocumentDialog
        open
        mode="upload"
        onClose={onClose}
        patientId="patient-1"
        defaultFolderId="labs-id"
        onUploaded={onUploaded}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Folder' })).toHaveTextContent('Labs');
    const uploadButton = screen.getByRole('button', { name: 'Upload' });
    expect(uploadButton).toBeDisabled();

    await user.upload(document.body.querySelector('input[type="file"]') ?? container, pdf('cbc results.pdf'));
    expect(screen.getByText('cbc results.pdf')).toBeInTheDocument();
    await user.click(uploadButton);

    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({ fileFolderId: 'labs-id', internalName: 'labs', fileName: 'cbc results.pdf' })
      )
    );
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'labs-id' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('asks for a folder when opened from All Documents, and rejects file names the upload would refuse', async () => {
    const user = userEvent.setup();
    render(<UploadDocumentDialog open mode="upload" onClose={vi.fn()} patientId="patient-1" />);

    expect(screen.getByRole('combobox', { name: 'Folder' })).not.toHaveTextContent(/Labs|Imaging/);
    await user.upload(document.body.querySelector('input[type="file"]')!, pdf('bad#name.pdf'));

    expect(screen.getByText('bad#name.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Invalid file name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('scans into the chosen folder: Scan is enabled once a folder is chosen', async () => {
    const user = userEvent.setup();
    render(<UploadDocumentDialog open mode="scan" onClose={vi.fn()} patientId="patient-1" />);

    expect(screen.getByText('Scan Document')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Folder' }));
    await user.click(screen.getByRole('option', { name: 'Imaging' }));

    expect(screen.getByRole('button', { name: 'Scan' })).toBeEnabled();
  });

  it('uploads a finished scan as one PDF into the chosen folder', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <UploadDocumentDialog open mode="scan" onClose={onClose} patientId="patient-1" defaultFolderId="imaging-id" />
    );

    await user.click(screen.getByRole('button', { name: 'Scan' }));
    // The main dialog steps aside while the scanner is open, so find the stand-in by its text.
    await user.click(await screen.findByText('Finish scan'));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({ fileFolderId: 'imaging-id', fileName: 'scan 1.pdf' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open with the file when the upload fails, and reports the error', async () => {
    mockUpload.mockRejectedValue(new Error('network down'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <UploadDocumentDialog open mode="upload" onClose={onClose} patientId="patient-1" defaultFolderId="labs-id" />
    );

    await user.upload(document.body.querySelector('input[type="file"]')!, pdf('cbc results.pdf'));
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(mockCapture).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('cbc results.pdf')).toBeInTheDocument();
  });
});
