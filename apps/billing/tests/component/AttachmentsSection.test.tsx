import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { enqueueSnackbar } from 'notistack';
import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { AttachmentsSection, AttachmentsSectionProps } from '../../src/components/attachments/AttachmentsSection';

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const REPORT_TYPES = [
  { code: 'OZ', label: 'Support Data for Claim' },
  { code: 'RR', label: 'Radiology Reports' },
];

const attachments = [{ id: 'doc-1', fileName: 'Remit.pdf', dateAdded: '2026-09-13T15:00:00Z', reportTypeCode: 'RR' }];

type Handler<K extends 'onUpload' | 'onRename' | 'onDelete' | 'getDownloadUrl'> = Mock<
  NonNullable<AttachmentsSectionProps[K]>
>;

const handlers = (): {
  onUpload: Handler<'onUpload'>;
  onRename: Handler<'onRename'>;
  onDelete: Handler<'onDelete'>;
  getDownloadUrl: Handler<'getDownloadUrl'>;
} => ({
  onUpload: vi.fn<NonNullable<AttachmentsSectionProps['onUpload']>>().mockResolvedValue(undefined),
  onRename: vi.fn<NonNullable<AttachmentsSectionProps['onRename']>>().mockResolvedValue(undefined),
  onDelete: vi.fn<NonNullable<AttachmentsSectionProps['onDelete']>>().mockResolvedValue(undefined),
  getDownloadUrl: vi.fn<AttachmentsSectionProps['getDownloadUrl']>().mockResolvedValue('https://z3.example/signed'),
});

// the tab a download opens, before the page sends it to the file
const blankTab = (): { opener: Window | null; location: { href: string }; close: Mock } => ({
  opener: window,
  location: { href: 'about:blank' },
  close: vi.fn(),
});

const dropFile = async (file: File): Promise<void> => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText(file.name, { selector: '.MuiListItemText-primary' });
};

describe('AttachmentsSection', () => {
  afterEach(() => vi.restoreAllMocks());

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

  it('turns away a file over 20 MB', async () => {
    const actions = handlers();
    render(<AttachmentsSection attachments={[]} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const scan = new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' });
    Object.defineProperty(scan, 'size', { value: 20 * 1024 * 1024 + 1 });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [scan] } });

    expect(
      await screen.findByText('File could not be uploaded. Please select a file smaller than 20 MB.')
    ).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    // the file never made it into the form: no file, and so no name taken from it
    expect(await screen.findAllByText('This field is required')).toHaveLength(2);
    expect(actions.onUpload).not.toHaveBeenCalled();
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

  it('opens the download tab within the click, then sends it to the file', async () => {
    const actions = handlers();
    let resolveUrl: (url: string) => void = () => undefined;
    actions.getDownloadUrl.mockReturnValueOnce(new Promise((resolve) => (resolveUrl = resolve)));
    const tab = blankTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    render(<AttachmentsSection attachments={attachments} {...actions} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    // a tab opened only after the URL comes back counts as a popup, which browsers may block
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(actions.getDownloadUrl).toHaveBeenCalledWith('doc-1');

    resolveUrl('https://z3.example/signed');
    await waitFor(() => expect(tab.location.href).toBe('https://z3.example/signed'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("closes the tab and says why when the file can't be reached", async () => {
    const actions = handlers();
    actions.getDownloadUrl.mockRejectedValueOnce(new Error('DocumentReference doc-1 is not attached to Claim/c1'));
    const tab = blankTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    render(<AttachmentsSection attachments={attachments} {...actions} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(enqueueSnackbar).toHaveBeenCalledWith('DocumentReference doc-1 is not attached to Claim/c1', {
      variant: 'error',
    });
  });

  it('deletes after confirmation', async () => {
    const actions = handlers();
    render(<AttachmentsSection attachments={attachments} {...actions} />);

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
