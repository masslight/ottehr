import { fireEvent, render, waitFor } from '@testing-library/react';
import imageCompression from 'browser-image-compression';
import { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { PaperworkContext } from 'ui-components';
import {
  COMPRESS_TARGET_MB,
  COMPRESS_THRESHOLD_MB,
  FileInput,
} from 'ui-components/lib/components/paperwork/form-components';
import { describe, expect, test, vi } from 'vitest';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}));

vi.mock('heic-to', () => ({
  heicTo: vi.fn(),
  isHeic: vi.fn(async () => false),
}));

vi.mock('ui-components', async () => {
  const actual = await vi.importActual<typeof import('ui-components')>('ui-components');
  return {
    ...actual,
    convertHeicToJpegIfNeeded: vi.fn(async (file: File) => file),
  };
});

vi.mock('../../src/hooks/useUCZambdaClient', () => ({
  useUCZambdaClient: () => null,
}));

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
}

const makeFile = (sizeBytes: number, name = 'photo.jpg', type = 'image/jpeg'): File => {
  const blob = new Blob([new Uint8Array(Math.round(sizeBytes))], { type });
  return new File([blob], name, { type });
};

const stubPaperworkContext = (): PaperworkContext =>
  ({
    appointment: { id: 'appt-1' },
    setSaveButtonDisabled: vi.fn(),
    paperworkComponentHelpers: {
      createZ3Object: vi.fn(),
    },
  }) as unknown as PaperworkContext;

const Wrapper: FC<{ attachmentType?: 'image' | 'pdf' }> = ({ attachmentType = 'image' }) => {
  const methods = useForm({ defaultValues: { 'insurance-card-front': undefined } });
  return (
    <FormProvider {...methods}>
      <FileInput
        fieldName="insurance-card-front"
        fileName="insurance-card-front"
        value={undefined}
        description="Upload a photo"
        attachmentType={attachmentType}
        onChange={vi.fn()}
        usePaperworkContext={stubPaperworkContext}
      />
    </FormProvider>
  );
};

const findFileInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not found');
  return input as HTMLInputElement;
};

const MB = 1024 * 1024;

describe('FileInput image compression', () => {
  test('skips compression for images under the threshold', async () => {
    const mocked = vi.mocked(imageCompression);
    mocked.mockClear();

    const { container } = render(<Wrapper />);
    const input = findFileInput(container);

    const smallFile = makeFile((COMPRESS_THRESHOLD_MB - 0.5) * MB);
    fireEvent.change(input, { target: { files: [smallFile] } });

    await waitFor(() => {
      expect(mocked).not.toHaveBeenCalled();
    });
  });

  test('compresses images exactly at the threshold', async () => {
    const mocked = vi.mocked(imageCompression);
    mocked.mockClear();

    const { container } = render(<Wrapper />);
    const input = findFileInput(container);

    const thresholdFile = makeFile(COMPRESS_THRESHOLD_MB * MB);
    fireEvent.change(input, { target: { files: [thresholdFile] } });

    await waitFor(() => {
      expect(mocked).toHaveBeenCalledTimes(1);
    });
    expect(mocked).toHaveBeenCalledWith(thresholdFile, { maxSizeMB: COMPRESS_TARGET_MB });
  });

  test('compresses images over the threshold', async () => {
    const mocked = vi.mocked(imageCompression);
    mocked.mockClear();

    const { container } = render(<Wrapper />);
    const input = findFileInput(container);

    const largeFile = makeFile((COMPRESS_THRESHOLD_MB + 1) * MB);
    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(mocked).toHaveBeenCalledTimes(1);
    });
    expect(mocked).toHaveBeenCalledWith(largeFile, { maxSizeMB: COMPRESS_TARGET_MB });
  });

  test('does not compress pdf attachments regardless of size', async () => {
    const mocked = vi.mocked(imageCompression);
    mocked.mockClear();

    const { container } = render(<Wrapper attachmentType="pdf" />);
    const input = findFileInput(container);

    const largePdf = makeFile((COMPRESS_THRESHOLD_MB + 1) * MB, 'doc.pdf', 'application/pdf');
    fireEvent.change(input, { target: { files: [largePdf] } });

    await waitFor(() => {
      expect(mocked).not.toHaveBeenCalled();
    });
  });
});
