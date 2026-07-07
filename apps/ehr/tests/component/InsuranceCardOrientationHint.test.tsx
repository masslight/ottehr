import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrontCardOrientationHint } from '../../src/features/visits/shared/components/patient/useInsuranceCardExtraction';

// ============================================================================
// MOCKS
// ============================================================================
const { mockRotateInsuranceCardImage, mockEnqueueSnackbar, mockOystehrZambda, extractionState } = vi.hoisted(() => ({
  mockRotateInsuranceCardImage: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
  mockOystehrZambda: { zambda: { execute: vi.fn() } },
  // Mutable per-test state the mocked extraction hook returns.
  extractionState: {
    frontOrientation: { primary: null, secondary: null } as Record<
      'primary' | 'secondary',
      { docRefId: string; readable: boolean | null } | null
    >,
  },
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

// Mock the extraction hook: the component must never hit FHIR in this test.
vi.mock('src/features/visits/shared/components/patient/useInsuranceCardExtraction', () => ({
  useInsuranceCardExtraction: () => ({
    primary: null,
    secondary: null,
    frontOrientation: extractionState.frontOrientation,
    isLoading: false,
  }),
}));

// Imported AFTER the mocks so they take effect.
import InsuranceCardOrientationHint, {
  CARD_MAY_BE_ROTATED_LABEL,
  ROTATE_CARD_BUTTON_LABEL,
} from '../../src/components/InsuranceCardOrientationHint';

// ============================================================================
// HARNESS
// ============================================================================
const DOC_REF_ID = 'docref-front-1';
const PATIENT_ID = 'patient-1';

interface RenderOverrides {
  documentReferenceId?: string | null;
  ordinal?: 'primary' | 'secondary';
  face?: 'front' | 'back';
}

const renderHint = (overrides: RenderOverrides = {}): { onRotated: ReturnType<typeof vi.fn> } => {
  const onRotated = vi.fn().mockResolvedValue(undefined);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactElement = (
    <QueryClientProvider client={queryClient}>
      <InsuranceCardOrientationHint
        patientId={PATIENT_ID}
        ordinal={overrides.ordinal ?? 'primary'}
        face={overrides.face ?? 'front'}
        documentReferenceId={overrides.documentReferenceId === undefined ? DOC_REF_ID : overrides.documentReferenceId}
        onRotated={onRotated}
      />
    </QueryClientProvider>
  );
  render(ui);
  return { onRotated };
};

const setFrontHint = (hint: FrontCardOrientationHint | null): void => {
  extractionState.frontOrientation = { primary: hint, secondary: null };
};

beforeEach(() => {
  vi.clearAllMocks();
  setFrontHint(null);
});

// ============================================================================
// TESTS
// ============================================================================
describe('InsuranceCardOrientationHint', () => {
  it('renders the badge and rotate button when the OCR judged the displayed card not right-side-up', () => {
    setFrontHint({ docRefId: DOC_REF_ID, readable: false });
    renderHint();

    expect(screen.getByText(CARD_MAY_BE_ROTATED_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });

  it('rotates 90 degrees clockwise on click and refreshes the displayed image', async () => {
    setFrontHint({ docRefId: DOC_REF_ID, readable: false });
    mockRotateInsuranceCardImage.mockResolvedValue({ documentReferenceId: DOC_REF_ID, rotated: true });
    const { onRotated } = renderHint();

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));

    await waitFor(() => {
      expect(mockRotateInsuranceCardImage).toHaveBeenCalledWith(mockOystehrZambda, {
        documentReferenceId: DOC_REF_ID,
        rotationDegrees: 90,
      });
    });
    await waitFor(() => expect(onRotated).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/rotated/i), { variant: 'success' })
    );
  });

  it('surfaces a rotate failure via the snackbar, does not refresh the image, and keeps the badge', async () => {
    setFrontHint({ docRefId: DOC_REF_ID, readable: false });
    mockRotateInsuranceCardImage.mockRejectedValue(new Error('rotate failed'));
    const { onRotated } = renderHint();

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));

    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/failed to rotate/i), {
        variant: 'error',
      })
    );
    expect(onRotated).not.toHaveBeenCalled();
    // The rotate did NOT happen, so the "may be rotated" badge must stay.
    expect(screen.getByText(CARD_MAY_BE_ROTATED_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });

  it.each([
    ['readable is true (card judged upright)', true],
    ['readable is null (no verdict)', null],
  ])('renders the rotate button but no badge when %s', (_label, readable) => {
    setFrontHint({ docRefId: DOC_REF_ID, readable: readable as boolean | null });
    renderHint();

    expect(screen.queryByText(CARD_MAY_BE_ROTATED_LABEL)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });

  it('renders the rotate button but no badge when the card has no stored orientation hint at all', () => {
    setFrontHint(null);
    renderHint();

    expect(screen.queryByText(CARD_MAY_BE_ROTATED_LABEL)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });

  it('renders the rotate button but no badge when the verdict belongs to a different (replaced) card image', () => {
    setFrontHint({ docRefId: 'docref-old-deleted', readable: false });
    renderHint();

    expect(screen.queryByText(CARD_MAY_BE_ROTATED_LABEL)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });

  it('renders the rotate button but no badge for a BACK card (OCR judges the front only)', () => {
    // Even with a front verdict present for the same ordinal, the back card shows no badge.
    setFrontHint({ docRefId: DOC_REF_ID, readable: false });
    renderHint({ face: 'back', documentReferenceId: 'docref-back-1' });

    expect(screen.queryByText(CARD_MAY_BE_ROTATED_LABEL)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });

  it('renders nothing when there is no displayed card (no DocumentReference id)', () => {
    setFrontHint({ docRefId: DOC_REF_ID, readable: false });
    renderHint({ documentReferenceId: null });

    expect(screen.queryByText(CARD_MAY_BE_ROTATED_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).not.toBeInTheDocument();
  });

  it('keeps the rotate control mounted across rotates so a 180°/270° card can be fixed with repeated clicks', async () => {
    setFrontHint({ docRefId: DOC_REF_ID, readable: false });
    mockRotateInsuranceCardImage.mockResolvedValue({ documentReferenceId: DOC_REF_ID, rotated: true });
    const { onRotated } = renderHint();

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));
    await waitFor(() => expect(mockRotateInsuranceCardImage).toHaveBeenCalledTimes(1));
    // Wait for the in-flight spinner to clear so the second click hits an enabled button.
    await waitFor(() => expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));
    await waitFor(() => expect(mockRotateInsuranceCardImage).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));
    await waitFor(() => expect(mockRotateInsuranceCardImage).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(onRotated).toHaveBeenCalledTimes(3));
  });

  it('suppresses the badge after a successful rotate even when a stale readable=false verdict persists', async () => {
    // Simulate the backend readable-reset patch failing: the mocked extraction keeps returning
    // readable=false for this DocRef even after the rotate + refetch.
    setFrontHint({ docRefId: DOC_REF_ID, readable: false });
    mockRotateInsuranceCardImage.mockResolvedValue({ documentReferenceId: DOC_REF_ID, rotated: true });
    renderHint();

    expect(screen.getByText(CARD_MAY_BE_ROTATED_LABEL)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL }));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/rotated/i), { variant: 'success' })
    );

    // The stale verdict must NOT re-show the badge and invite an over-rotate...
    expect(screen.queryByText(CARD_MAY_BE_ROTATED_LABEL)).not.toBeInTheDocument();
    // ...but the rotate button stays available for further 90° corrections.
    expect(screen.getByRole('button', { name: ROTATE_CARD_BUTTON_LABEL })).toBeEnabled();
  });
});
