import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================
const { mockRotateCardImage, mockEnqueueSnackbar, mockOystehrZambda } = vi.hoisted(() => ({
  mockRotateCardImage: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
  mockOystehrZambda: { zambda: { execute: vi.fn() } },
}));

vi.mock('src/api/api', () => ({
  rotateCardImage: mockRotateCardImage,
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: undefined, oystehrZambda: mockOystehrZambda }),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: mockEnqueueSnackbar,
}));

// Imported AFTER the mocks so they take effect.
import RotateCardButton, { ROTATE_CARD_BUTTON_LABEL } from '../../src/components/RotateCardButton';

// ============================================================================
// TESTS
// ============================================================================
const FRONT_DOC_REF_ID = 'photo-id-front-docref';
const BACK_DOC_REF_ID = 'photo-id-back-docref';

describe('RotateCardButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no image to rotate', () => {
    render(<RotateCardButton documentReferenceId={null} onRotated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).not.toBeInTheDocument();
  });

  it.each([
    ['front', FRONT_DOC_REF_ID],
    ['back', BACK_DOC_REF_ID],
  ])('rotates only the %s DocumentReference 90 degrees clockwise and refreshes the image', async (_face, docRefId) => {
    mockRotateCardImage.mockResolvedValue({ documentReferenceId: docRefId, rotated: true });
    const onRotated = vi.fn().mockResolvedValue(undefined);
    render(<RotateCardButton documentReferenceId={docRefId} onRotated={onRotated} />);

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));

    await waitFor(() => expect(onRotated).toHaveBeenCalledTimes(1));
    expect(mockRotateCardImage).toHaveBeenCalledTimes(1);
    expect(mockRotateCardImage).toHaveBeenCalledWith(mockOystehrZambda, {
      documentReferenceId: docRefId,
      rotationDegrees: 90,
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/rotated/i), { variant: 'success' });
  });

  it('shows an error and does not refresh the image when the rotate fails', async () => {
    mockRotateCardImage.mockRejectedValue(new Error('rotate failed'));
    const onRotated = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<RotateCardButton documentReferenceId={FRONT_DOC_REF_ID} onRotated={onRotated} />);

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));

    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/failed/i), { variant: 'error' })
    );
    expect(onRotated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });
});
