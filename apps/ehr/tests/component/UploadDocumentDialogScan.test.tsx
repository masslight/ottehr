import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpload, scanner } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  scanner: {
    isInitialized: true,
    isScanning: false,
    isRefreshingScanners: false,
    scanners: [{ displayName: 'Desk scanner' }],
    currentScanner: 'Desk scanner',
    imageCount: 1,
    selectedZone: null,
    error: null,
    initializeScanner: async (): Promise<void> => undefined,
    setCurrentScanner: (): void => undefined,
    refreshScanners: async (): Promise<void> => undefined,
    acquireImage: async (): Promise<void> => undefined,
    getImageAsBlob: async (): Promise<Blob | null> => null,
    getAllImagesAsPdf: async (): Promise<Blob | null> => new Blob(['%PDF']),
    getAllImagesAsPng: async (): Promise<Blob[]> => [],
    removeImage: (): void => undefined,
    removeCurrentImage: (): void => undefined,
    removeAllImages: (): void => undefined,
    rotateLeft: (): void => undefined,
    rotateRight: (): void => undefined,
    rotate180: (): void => undefined,
    flipVertical: (): void => undefined,
    mirror: (): void => undefined,
    crop: (): void => undefined,
    cleanup: (): void => undefined,
  },
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('utils/lib/frontend/sentry', () => ({ safelyCaptureException: vi.fn() }));
vi.mock('src/hooks/useDynamsoftScanner', () => ({ useDynamsoftScanner: () => scanner }));
vi.mock('src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocsFolders: () => ({ data: {} }),
  parsePatientDocsFolders: () => [
    { id: 'imaging-id', folderName: 'Imaging', internalName: 'imaging', documentsCount: 0, isCustom: false },
  ],
  usePatientDocsActions: () => ({ uploadDocumentAction: mockUpload, isUploading: false }),
}));

import { UploadDocumentDialog } from '../../src/features/visits/shared/components/patient/docs/UploadDocumentDialog';

const openScanner = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  render(
    <UploadDocumentDialog open mode="scan" onClose={vi.fn()} patientId="patient-1" defaultFolderId="imaging-id" />
  );
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  const fileNameInput = await screen.findByPlaceholderText('Enter file name');
  await user.clear(fileNameInput);
  return fileNameInput;
};

describe('UploadDocumentDialog scanning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({});
  });

  it.each(['scan-20261110-111003#', 'scan\\01'])(
    'rejects the scanned file name %s before saving the scan',
    async (fileName) => {
      const user = userEvent.setup();
      const fileNameInput = await openScanner(user);

      await user.type(fileNameInput, fileName);

      expect(screen.getByText(/Invalid file name/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();
    }
  );

  it('uploads a scan with a valid file name as a PDF', async () => {
    const user = userEvent.setup();
    const fileNameInput = await openScanner(user);

    await user.type(fileNameInput, 'scan 1');
    expect(screen.queryByText(/Invalid file name/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save/ }));

    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({ fileFolderId: 'imaging-id', fileName: 'scan 1.pdf' })
      )
    );
  });
});
