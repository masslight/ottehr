import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportEraDialog } from '../../src/components/ImportEraDialog';
import { MAX_ERA_FILE_SIZE_BYTES, ReadEraFileResult } from '../../src/utils/eraFile';

const { importEraMock, readEraFileMock } = vi.hoisted(() => ({
  importEraMock: vi.fn(),
  readEraFileMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  importEra: importEraMock,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));
vi.mock('../../src/utils/eraFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/utils/eraFile')>()),
  readEraFile: readEraFileMock,
}));

const X12 = 'ISA*00*          *00*          *ZZ*SENDER~GS*HP*SENDER*RECEIVER~ST*835*0001~';

const JPEG_ERROR = 'This file is image/jpeg, not a text-based 835/X12 file.';
const TOO_LARGE_ERROR = `File is too large. The maximum ERA file size is 5 MB.`;

function dropFile(file: File): void {
  const fileInput = screen.getByLabelText('file upload');
  // In jsdom, the files property has to be defined before the change event fires
  Object.defineProperty(fileInput, 'files', {
    value: [file],
    writable: false,
    configurable: true,
  });
  fireEvent.change(fileInput);
}

function textFile(name: string, content: BlobPart = X12): File {
  return new File([content], name, {
    type: 'text/plain',
  });
}

function oversizedFile(): File {
  const file = textFile('remit.835');
  Object.defineProperty(file, 'size', {
    value: MAX_ERA_FILE_SIZE_BYTES + 1,
  });
  return file;
}

// Hands back the resolvers for every read started from here on, so a test can land them out of order.
function deferReads(): Array<(result: ReadEraFileResult) => void> {
  const pendingReads: Array<(result: ReadEraFileResult) => void> = [];
  readEraFileMock.mockImplementation(() => new Promise<ReadEraFileResult>((resolve) => pendingReads.push(resolve)));
  return pendingReads;
}

function getEraTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: /ERA in X12 Format/i }) as HTMLTextAreaElement;
}

describe('ImportEraDialog', () => {
  beforeEach(async () => {
    importEraMock.mockReset();
    importEraMock.mockResolvedValue({
      resourceType: 'Bundle',
      entry: [],
    });
    const actual = await vi.importActual<typeof import('../../src/utils/eraFile')>('../../src/utils/eraFile');
    readEraFileMock.mockReset();
    readEraFileMock.mockImplementation(actual.readEraFile);
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

    dropFile(textFile('remit.835'));

    await waitFor(() => expect(getEraTextarea()).toHaveValue(X12));
    expect(screen.getByText('remit.835')).toBeInTheDocument();
  });

  it('imports the edited text rather than the uploaded file', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(textFile('remit.835'));
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

    dropFile(oversizedFile());

    expect(await screen.findByText(TOO_LARGE_ERROR)).toBeVisible();
    expect(getEraTextarea()).toHaveValue('');
  });

  it('shows a format error for a binary file', async () => {
    render(<ImportEraDialog onClose={() => {}} />);

    dropFile(textFile('remit.txt', new Uint8Array([0xff, 0xd8, 0xff])));

    expect(await screen.findByText(JPEG_ERROR)).toBeVisible();
    expect(getEraTextarea()).toHaveValue('');
  });

  it('does not list a rejected file as if it had been accepted', async () => {
    render(<ImportEraDialog onClose={() => {}} />);

    dropFile(oversizedFile());

    await screen.findByText(TOO_LARGE_ERROR);
    expect(screen.queryByText('remit.835')).not.toBeInTheDocument();
  });

  it('keeps the file error visible across a submit attempt', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(oversizedFile());
    await screen.findByText(TOO_LARGE_ERROR);
    const importButton = screen.getByRole('button', { name: 'Import' });

    fireEvent.click(importButton);

    expect(await screen.findByText('This field is required')).toBeVisible();
    expect(screen.getByText(TOO_LARGE_ERROR)).toBeVisible();
    expect(importEraMock).not.toHaveBeenCalled();
  });

  it('clears a stale file error once the era text is edited', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(oversizedFile());
    await screen.findByText(TOO_LARGE_ERROR);

    fireEvent.change(getEraTextarea(), {
      target: {
        value: X12,
      },
    });

    expect(screen.queryByText(TOO_LARGE_ERROR)).not.toBeInTheDocument();
  });

  it('clears the error when a valid file follows a rejected one', async () => {
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(textFile('remit.txt', new Uint8Array([0xff, 0xd8, 0xff])));
    await screen.findByText(JPEG_ERROR);

    dropFile(textFile('remit.835'));

    await waitFor(() => expect(getEraTextarea()).toHaveValue(X12));
    expect(screen.queryByText(JPEG_ERROR)).not.toBeInTheDocument();
  });

  it('locks the era field and the import button while a file is being read', async () => {
    const pendingReads = deferReads();
    render(<ImportEraDialog onClose={() => {}} />);

    dropFile(textFile('remit.835'));

    await waitFor(() => expect(getEraTextarea()).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(screen.getByText('Reading file...')).toBeVisible();

    await act(async () => {
      pendingReads[0]({
        ok: true,
        text: X12,
      });
    });

    expect(getEraTextarea()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
    expect(screen.queryByText('Reading file...')).not.toBeInTheDocument();
  });

  it('unlocks the era field when a read fails', async () => {
    const pendingReads = deferReads();
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(textFile('remit.835'));
    await waitFor(() => expect(getEraTextarea()).toBeDisabled());

    await act(async () => {
      pendingReads[0]({
        ok: false,
        error: TOO_LARGE_ERROR,
      });
    });

    expect(getEraTextarea()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('unlocks the era field when a rejected file interrupts a pending read', async () => {
    deferReads();
    render(<ImportEraDialog onClose={() => {}} />);
    dropFile(textFile('remit.835'));
    await waitFor(() => expect(getEraTextarea()).toBeDisabled());

    // react-dropzone reports no accepted files, so the field is cleared and the read never lands
    dropFile(
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'scan.pdf', {
        type: 'application/pdf',
      })
    );

    await waitFor(() => expect(getEraTextarea()).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('ignores a read that a newer file has superseded', async () => {
    const pendingReads = deferReads();
    render(<ImportEraDialog onClose={() => {}} />);

    dropFile(textFile('first.835'));
    await waitFor(() => expect(pendingReads).toHaveLength(1));
    dropFile(textFile('second.835'));
    await waitFor(() => expect(pendingReads).toHaveLength(2));

    pendingReads[1]({
      ok: true,
      text: 'SECOND',
    });
    await waitFor(() => expect(getEraTextarea()).toHaveValue('SECOND'));
    await act(async () => {
      pendingReads[0]({
        ok: true,
        text: 'FIRST',
      });
    });

    expect(getEraTextarea()).toHaveValue('SECOND');
  });
});
