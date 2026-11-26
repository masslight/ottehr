import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedCardItem } from '../../src/hooks/useVisitCards';

// ============================================================================
// MOCKS
// ============================================================================
// A minimal stand-in for the real uploader: exposes just enough (fileName label + a button that
// fires submitAttachment) to prove CardThumbnail wires the right fileType to the right slot,
// without dragging in the real component's compression/HEIC/Z3 dependencies.
vi.mock('src/components/ImageUploader', () => ({
  default: ({ fileName, submitAttachment }: { fileName: string; submitAttachment: (a: unknown) => Promise<void> }) => (
    <button onClick={() => void submitAttachment({ url: 'https://z3.example.com/new.jpg' })}>Upload {fileName}</button>
  ),
}));

import CardThumbnail from '../../src/components/CardThumbnail';

// ============================================================================
// HARNESS
// ============================================================================
const FRONT_URL = 'https://presigned.example.com/card-front.png';
const BACK_URL = 'https://presigned.example.com/card-back.png';
const TITLE = 'Primary Insurance Card';

const EMPTY_ITEM: SavedCardItem = { front: null, frontId: null, back: null, backId: null };

const makeItem = (overrides: Partial<SavedCardItem> = {}): SavedCardItem => ({ ...EMPTY_ITEM, ...overrides });

const mockFilesMutator = { mutateAsync: vi.fn().mockResolvedValue(undefined) } as any;

interface RenderOverrides {
  item?: SavedCardItem;
  handleDeleteClick?: (id: string | null) => Promise<void>;
  deletingFileId?: string | null;
}

const renderThumbnail = (overrides: RenderOverrides = {}): void => {
  render(
    <CardThumbnail
      item={overrides.item ?? EMPTY_ITEM}
      title={TITLE}
      appointmentID="appt-1"
      filesMutator={mockFilesMutator}
      uploadingFileType={null}
      handleOpenScanner={vi.fn()}
      imagesLoading={false}
      frontFileType="insurance-card-front"
      backFileType="insurance-card-back"
      handleDeleteClick={overrides.handleDeleteClick}
      deletingFileId={overrides.deletingFileId}
    />
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TESTS
// ============================================================================
describe('CardThumbnail', () => {
  it('renders the title and a labeled upload placeholder for each face when neither has an image', () => {
    renderThumbnail();

    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText('Front')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Upload insurance-card-front')).toBeInTheDocument();
    expect(screen.getByText('Upload insurance-card-back')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Enlarge/ })).not.toBeInTheDocument();
  });

  it('renders a clickable front thumbnail and a back placeholder when only the front exists', () => {
    renderThumbnail({ item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }) });

    expect(screen.getByRole('button', { name: `Enlarge ${TITLE} front` })).toBeInTheDocument();
    expect(screen.getByAltText(`${TITLE} front`)).toHaveAttribute('src', FRONT_URL);
    expect(screen.queryByRole('button', { name: `Enlarge ${TITLE} back` })).not.toBeInTheDocument();
    expect(screen.getByText('Upload insurance-card-back')).toBeInTheDocument();
  });

  it('shows both thumbnails side by side and opens the preview on the clicked face', async () => {
    const user = userEvent.setup();
    renderThumbnail({
      item: makeItem({
        front: { presignedUrl: FRONT_URL } as any,
        frontId: 'doc-front',
        back: { presignedUrl: BACK_URL } as any,
        backId: 'doc-back',
      }),
      handleDeleteClick: vi.fn(),
    });

    expect(screen.getByAltText(`${TITLE} front`)).toHaveAttribute('src', FRONT_URL);
    expect(screen.getByAltText(`${TITLE} back`)).toHaveAttribute('src', BACK_URL);

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} back` }));

    const dialog = screen.getByRole('dialog', { name: `${TITLE} preview` });
    expect(within(dialog).getByRole('button', { name: `Remove ${TITLE} back` })).toBeInTheDocument();
  });

  it('switches the open preview to whichever thumbnail is clicked next', async () => {
    const user = userEvent.setup();
    renderThumbnail({
      item: makeItem({
        front: { presignedUrl: FRONT_URL } as any,
        frontId: 'doc-front',
        back: { presignedUrl: BACK_URL } as any,
        backId: 'doc-back',
      }),
      handleDeleteClick: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} front` }));
    const dialog = screen.getByRole('dialog', { name: `${TITLE} preview` });
    expect(within(dialog).getByRole('button', { name: `Remove ${TITLE} front` })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} back` }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: `Remove ${TITLE} back` })).toBeInTheDocument()
    );

    // Also after the in-preview toggle moved the face away from the last clicked thumbnail.
    await user.click(within(dialog).getByRole('button', { name: `Show front of ${TITLE} preview` }));
    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} back` }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: `Remove ${TITLE} back` })).toBeInTheDocument()
    );
  });

  it('shows only the back thumbnail (with a front placeholder) when only the back exists', () => {
    renderThumbnail({ item: makeItem({ back: { presignedUrl: BACK_URL } as any, backId: 'doc-back' }) });

    expect(screen.getByAltText(`${TITLE} back`)).toHaveAttribute('src', BACK_URL);
    expect(screen.getByText('Upload insurance-card-front')).toBeInTheDocument();
  });

  it('opens the floating preview on click, without a delete button when handleDeleteClick is omitted', async () => {
    const user = userEvent.setup();
    renderThumbnail({ item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }) });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} front` }));

    expect(screen.getByRole('dialog', { name: `${TITLE} preview` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Remove ${TITLE} front` })).not.toBeInTheDocument();
    // No delete wired -> only one face present -> toggle stays hidden (unchanged legacy behavior).
    expect(screen.queryByRole('button', { name: `Show back of ${TITLE} preview` })).not.toBeInTheDocument();
  });

  it("removing a face: confirms, calls handleDeleteClick with that face's DocRef id", async () => {
    const user = userEvent.setup();
    const handleDeleteClick = vi.fn().mockResolvedValue(undefined);
    renderThumbnail({
      item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }),
      handleDeleteClick,
    });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} front` }));
    await user.click(screen.getByRole('button', { name: `Remove ${TITLE} front` }));

    expect(screen.getByText('Remove card image')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(handleDeleteClick).toHaveBeenCalledWith('doc-front');
  });

  it('cancelling the remove confirmation does not call handleDeleteClick', async () => {
    const user = userEvent.setup();
    const handleDeleteClick = vi.fn().mockResolvedValue(undefined);
    renderThumbnail({
      item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }),
      handleDeleteClick,
    });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} front` }));
    await user.click(screen.getByRole('button', { name: `Remove ${TITLE} front` }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(handleDeleteClick).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Remove card image')).not.toBeInTheDocument());
  });

  it('keeps the Front/Back toggle reachable when delete is wired, even with only one face present', async () => {
    const user = userEvent.setup();
    renderThumbnail({
      item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }),
      handleDeleteClick: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} front` }));
    // Unlike the no-delete case, the toggle is now available so the empty back slot stays reachable.
    await user.click(screen.getByRole('button', { name: `Show back of ${TITLE} preview` }));

    // The inline back placeholder also renders "Upload insurance-card-back", so scope to the preview.
    const dialog = screen.getByRole('dialog', { name: `${TITLE} preview` });
    await waitFor(() => expect(within(dialog).getByText('Upload insurance-card-back')).toBeInTheDocument());
  });

  it('does not show a remove button for a face that has no image', async () => {
    const user = userEvent.setup();
    renderThumbnail({
      item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }),
      handleDeleteClick: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE} front` }));
    await user.click(screen.getByRole('button', { name: `Show back of ${TITLE} preview` }));

    expect(screen.queryByRole('button', { name: `Remove ${TITLE} back` })).not.toBeInTheDocument();
  });
});
