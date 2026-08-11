import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportX12Dialog } from '../../src/components/ExportX12Dialog';

const { downloadTextFileMock } = vi.hoisted(() => ({
  downloadTextFileMock: vi.fn(),
}));

vi.mock('../../src/utils/downloadTextFile', () => ({ downloadTextFile: downloadTextFileMock }));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));

const X12 = 'ISA*00*~GS*HC*~ST*837*';
const FILE_NAME = 'claim-x12.txt';

function renderDialog(x12Provider: () => Promise<string> = () => Promise.resolve(X12)): ReactElement {
  return render(
    <ExportX12Dialog open onClose={() => {}} fileName={FILE_NAME} x12Provider={x12Provider} />
  ) as unknown as ReactElement;
}

describe('ExportX12Dialog', () => {
  beforeEach(() => {
    downloadTextFileMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('fetches and renders the raw X12', async () => {
    renderDialog();

    expect(await screen.findByDisplayValue(X12)).toBeInTheDocument();
  });

  it('copies the X12 to the clipboard', async () => {
    renderDialog();
    await screen.findByDisplayValue(X12);

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(X12));
  });

  it('downloads the X12 with a claim-type-specific filename', async () => {
    renderDialog();
    await screen.findByDisplayValue(X12);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    expect(downloadTextFileMock).toHaveBeenCalledWith(FILE_NAME, X12);
  });

  it('shows the error message returned by the export when generation fails', async () => {
    renderDialog(() => Promise.reject(new Error('Claim.provider is missing a required identifier')));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Claim.provider is missing a required identifier')).toBeInTheDocument();
  });
});
