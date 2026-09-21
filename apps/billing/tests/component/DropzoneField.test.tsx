import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { DropzoneField } from '../../src/components/DropzoneField';

const ACCEPT = {
  'text/plain': ['.835', '.txt'],
};

const SINGULAR_REJECTION = 'File could not be uploaded. Please select a file with an allowed type.';

interface HarnessProps {
  multiple?: boolean;
  required?: boolean;
  ariaLabel?: string;
}

function Harness({ multiple = false, required = false, ariaLabel }: HarnessProps): ReactElement {
  const methods = useForm<{ file: File | File[] | null }>({
    defaultValues: {
      file: null,
    },
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => {})}>
        <DropzoneField name="file" multiple={multiple} required={required} accept={ACCEPT} ariaLabel={ariaLabel} />
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

// In jsdom the files property has to be defined before the change event fires.
function dropFiles(files: File[], label = 'Upload file'): void {
  const fileInput = screen.getByLabelText(label);
  Object.defineProperty(fileInput, 'files', {
    value: files,
    writable: false,
    configurable: true,
  });
  fireEvent.change(fileInput);
}

function textFile(name: string): File {
  return new File(['ISA*00*~'], name, {
    type: 'text/plain',
  });
}

function pdfFile(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: 'application/pdf',
  });
}

describe('DropzoneField', () => {
  it('lists the accepted extensions', () => {
    render(<Harness />);

    expect(screen.getByText('Accepted types: .835, .txt')).toBeInTheDocument();
  });

  it('labels the file input so it is not reliant on the react-dropzone default', () => {
    render(<Harness />);

    expect(screen.getByLabelText('Upload file')).toHaveAttribute('type', 'file');
    expect(screen.queryByLabelText('file upload')).not.toBeInTheDocument();
  });

  it('lets the caller name what is being uploaded', async () => {
    render(<Harness ariaLabel="Upload ERA file" />);

    dropFiles([textFile('remit.835')], 'Upload ERA file');

    expect(await screen.findByText('remit.835')).toBeVisible();
  });

  it('lists the file name once a file is accepted', async () => {
    render(<Harness />);

    dropFiles([textFile('remit.835')]);

    expect(await screen.findByText('remit.835')).toBeVisible();
  });

  it('lists every file name in multiple mode', async () => {
    render(<Harness multiple />);

    dropFiles([textFile('first.835'), textFile('second.835')]);

    expect(await screen.findByText('first.835')).toBeVisible();
    expect(screen.getByText('second.835')).toBeVisible();
  });

  it('rejects a file whose type is not accepted', async () => {
    render(<Harness />);

    dropFiles([pdfFile('scan.pdf')]);

    expect(await screen.findByText(SINGULAR_REJECTION)).toBeVisible();
    expect(screen.queryByText('scan.pdf')).not.toBeInTheDocument();
  });

  it('pluralizes the rejection message when multiple files are allowed', async () => {
    render(<Harness multiple />);

    dropFiles([pdfFile('scan.pdf')]);

    expect(
      await screen.findByText('Files could not be uploaded. Please select files with an allowed type.')
    ).toBeVisible();
  });

  it('shows the rejection and required messages together without colliding ids', async () => {
    render(<Harness required />);
    dropFiles([pdfFile('scan.pdf')]);
    await screen.findByText(SINGULAR_REJECTION);
    const submitButton = screen.getByRole('button', { name: 'Submit' });

    fireEvent.click(submitButton);

    expect(await screen.findByText('This field is required')).toBeVisible();
    expect(screen.getByText(SINGULAR_REJECTION)).toBeVisible();
    const ids = Array.from(document.querySelectorAll('[id]')).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
