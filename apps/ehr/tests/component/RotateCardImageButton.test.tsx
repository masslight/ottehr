import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================
const { mockRotateInsuranceCardImage, mockEnqueueSnackbar, mockOystehrZambda } = vi.hoisted(() => ({
  mockRotateInsuranceCardImage: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
  mockOystehrZambda: { zambda: { execute: vi.fn() } },
}));

vi.mock('src/api/api', () => ({
  rotateInsuranceCardImage: mockRotateInsuranceCardImage,
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: undefined, oystehrZambda: mockOystehrZambda }),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: mockEnqueueSnackbar,
}));

// Imported AFTER the mocks so they take effect.
import RotateCardImageButton, { ROTATE_CARD_BUTTON_LABEL } from '../../src/components/RotateCardImageButton';

// ============================================================================
// HARNESS
// ============================================================================
const PHOTO_ID_DOC_REF_ID = 'docref-photo-id-front';

const renderButton = (): { onRotated: ReturnType<typeof vi.fn> } => {
  const onRotated = vi.fn().mockResolvedValue(undefined);
  render(<RotateCardImageButton documentReferenceId={PHOTO_ID_DOC_REF_ID} onRotated={onRotated} />);
  return { onRotated };
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TESTS
// ============================================================================
describe('RotateCardImageButton', () => {
  it('rotates the displayed image 90 degrees clockwise, refreshes it, and confirms', async () => {
    mockRotateInsuranceCardImage.mockResolvedValue({ documentReferenceId: PHOTO_ID_DOC_REF_ID, rotated: true });
    const { onRotated } = renderButton();

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));

    await waitFor(() =>
      expect(mockRotateInsuranceCardImage).toHaveBeenCalledWith(mockOystehrZambda, {
        documentReferenceId: PHOTO_ID_DOC_REF_ID,
        rotationDegrees: 90,
      })
    );
    await waitFor(() => expect(onRotated).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/rotated/i), { variant: 'success' })
    );
  });

  it('surfaces a rotate failure via the snackbar and does not refresh the image', async () => {
    mockRotateInsuranceCardImage.mockRejectedValue(new Error('rotate failed'));
    const { onRotated } = renderButton();

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));

    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/failed to rotate/i), {
        variant: 'error',
      })
    );
    expect(onRotated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });

  it('stays enabled after a rotate so a 180°/270° image can be fixed with repeated clicks', async () => {
    mockRotateInsuranceCardImage.mockResolvedValue({ documentReferenceId: PHOTO_ID_DOC_REF_ID, rotated: true });
    const { onRotated } = renderButton();

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));
    await waitFor(() => expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));

    await waitFor(() => expect(mockRotateInsuranceCardImage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onRotated).toHaveBeenCalledTimes(2));
  });
});
