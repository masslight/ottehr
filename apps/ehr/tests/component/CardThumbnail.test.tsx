import { render, screen, waitFor } from '@testing-library/react';
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
  it('renders the front-slot uploader when neither face has an image', () => {
    renderThumbnail();

    expect(screen.getByText('Upload insurance-card-front')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Enlarge ${TITLE}` })).not.toBeInTheDocument();
  });

  it('renders a clickable thumbnail (front preferred) when at least one face has an image', () => {
    renderThumbnail({ item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }) });

    expect(screen.getByRole('button', { name: `Enlarge ${TITLE}` })).toBeInTheDocument();
    expect(screen.getByAltText(`${TITLE} front`)).toHaveAttribute('src', FRONT_URL);
  });

  it('falls back to the back image when only the back exists', () => {
    renderThumbnail({ item: makeItem({ back: { presignedUrl: BACK_URL } as any, backId: 'doc-back' }) });

    expect(screen.getByAltText(`${TITLE} back`)).toHaveAttribute('src', BACK_URL);
  });

  it('opens the floating preview on click, without a delete button when handleDeleteClick is omitted', async () => {
    const user = userEvent.setup();
    renderThumbnail({ item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }) });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE}` }));

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

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE}` }));
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

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE}` }));
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

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE}` }));
    // Unlike the no-delete case, the toggle is now available so the empty back slot stays reachable.
    await user.click(screen.getByRole('button', { name: `Show back of ${TITLE} preview` }));

    await waitFor(() => expect(screen.getByText('Upload insurance-card-back')).toBeInTheDocument());
  });

  it('does not show a remove button for a face that has no image', async () => {
    const user = userEvent.setup();
    renderThumbnail({
      item: makeItem({ front: { presignedUrl: FRONT_URL } as any, frontId: 'doc-front' }),
      handleDeleteClick: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: `Enlarge ${TITLE}` }));
    await user.click(screen.getByRole('button', { name: `Show back of ${TITLE} preview` }));

    expect(screen.queryByRole('button', { name: `Remove ${TITLE} back` })).not.toBeInTheDocument();
  });
});
