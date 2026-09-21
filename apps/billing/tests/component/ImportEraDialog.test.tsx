import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportEraDialog } from '../../src/components/ImportEraDialog';
import { MAX_ERA_FILE_SIZE_BYTES } from '../../src/utils/eraFile';

const { importEraMock } = vi.hoisted(() => ({
  importEraMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  importEra: importEraMock,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));

const X12 = 'ISA*00*          *00*          *ZZ*SENDER~GS*HP*SENDER*RECEIVER~ST*835*0001~';

function dropFile(file: File): void {
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  // In jsdom, the files property has to be defined before the change event fires
  Object.defineProperty(fileInput, 'files', {
    value: [file],
    writable: false,
    configurable: true,
  });
  fireEvent.change(fileInput);
}

function getEraTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: /ERA in X12 Format/i }) as HTMLTextAreaElement;
}

describe('ImportEraDialog', () => {
  beforeEach(() => {
    importEraMock.mockReset();
    importEraMock.mockResolvedValue({
      resourceType: 'Bundle',
      entry: [],
    });
  });

  it('requires the ERA and sends no request when nothing is pasted or uploaded', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    const importButton = screen.getByRole('button', { name: 'Import' });

    fireEvent.click(importButton);

    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(importEraMock).not.toHaveBeenCalled();
  });

  it('imports pasted text', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    const textarea = getEraTextarea();

    fireEvent.change(textarea, {
      target: {
        value: X12,
      },
    });
    const importButton = screen.getByRole('button', { name: 'Import' });
    fireEvent.click(importButton);

    await waitFor(() =>
      expect(importEraMock).toHaveBeenCalledWith(expect.anything(), {
        era: X12,
      })
    );
  });

  it('fills the textarea with the contents of an uploaded file', async () => {
    render(<ImportEraDialog onClose={() => {}} />);

    dropFile(
      new File([X12], 'remit.835', {
        type: 'text/plain',
      })
    );

    await waitFor(() => expect(getEraTextarea()).toHaveValue(X12));
    expect(screen.getByText('remit.835')).toBeInTheDocument();
  });

  it('imports the edited text rather than the uploaded file', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(
      new File([X12], 'remit.835', {
        type: 'text/plain',
      })
    );
    await waitFor(() => expect(getEraTextarea()).toHaveValue(X12));

    const edited = `${X12}SE*10*0001~`;
    fireEvent.change(getEraTextarea(), {
      target: {
        value: edited,
      },
    });
    const importButton = screen.getByRole('button', { name: 'Import' });
    fireEvent.click(importButton);

    await waitFor(() =>
      expect(importEraMock).toHaveBeenCalledWith(expect.anything(), {
        era: edited,
      })
    );
  });

  it('shows a size error and leaves the textarea untouched for an oversized file', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    const file = new File([X12], 'remit.835', {
      type: 'text/plain',
    });
    Object.defineProperty(file, 'size', {
      value: MAX_ERA_FILE_SIZE_BYTES + 1,
    });

    dropFile(file);

    expect(await screen.findByText('File is too large. The maximum ERA file size is 5 MB.')).toBeInTheDocument();
    expect(getEraTextarea()).toHaveValue('');
  });

  it('shows a format error for a binary file', async () => {
    render(<ImportEraDialog onClose={() => {}} />);

    dropFile(
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'remit.txt', {
        type: 'text/plain',
      })
    );

    expect(await screen.findByText('This file does not look like a text-based 835/X12 file.')).toBeInTheDocument();
    expect(getEraTextarea()).toHaveValue('');
  });

  it('clears the error when a valid file follows a rejected one', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'remit.txt', {
        type: 'text/plain',
      })
    );
    await screen.findByText('This file does not look like a text-based 835/X12 file.');

    dropFile(
      new File([X12], 'remit.835', {
        type: 'text/plain',
      })
    );

    await waitFor(() => expect(getEraTextarea()).toHaveValue(X12));
    expect(screen.queryByText('This file does not look like a text-based 835/X12 file.')).not.toBeInTheDocument();
  });
});
