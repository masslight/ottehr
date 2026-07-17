import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportX12Dialog } from '../../src/components/ExportX12Dialog';

const { exportClaimX12Mock, downloadTextFileMock } = vi.hoisted(() => ({
  exportClaimX12Mock: vi.fn(),
  downloadTextFileMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({ exportClaimX12: exportClaimX12Mock }));
vi.mock('../../src/utils/downloadTextFile', () => ({ downloadTextFile: downloadTextFileMock }));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));

const X12 = 'ISA*00*~GS*HC*~ST*837*';

function renderDialog(claimType: 'professional' | 'institutional' = 'professional'): ReactElement {
  return render(
    <ExportX12Dialog open onClose={() => {}} claimId="claim-1" claimType={claimType} />
  ) as unknown as ReactElement;
}

describe('ExportX12Dialog', () => {
  beforeEach(() => {
    exportClaimX12Mock.mockReset();
    downloadTextFileMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('fetches and renders the raw X12', async () => {
    exportClaimX12Mock.mockResolvedValue({ x12: X12 });
    renderDialog();

    expect(await screen.findByDisplayValue(X12)).toBeInTheDocument();
    expect(exportClaimX12Mock).toHaveBeenCalledWith({}, { claimId: 'claim-1' });
  });

  it('copies the X12 to the clipboard', async () => {
    exportClaimX12Mock.mockResolvedValue({ x12: X12 });
    renderDialog();
    await screen.findByDisplayValue(X12);

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(X12));
  });

  it('downloads the X12 with a claim-type-specific filename', async () => {
    exportClaimX12Mock.mockResolvedValue({ x12: X12 });
    renderDialog('institutional');
    await screen.findByDisplayValue(X12);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadTextFileMock).toHaveBeenCalledWith('claim-claim-1-837i.txt', X12);
  });

  it('shows the error message returned by the export when generation fails', async () => {
    exportClaimX12Mock.mockRejectedValue({ message: 'Claim.provider is missing a required identifier' });
    renderDialog();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Claim.provider is missing a required identifier')).toBeInTheDocument();
  });
});
