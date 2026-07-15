import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DOT_VISION_SCREENING_LABELS } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS (must precede the component import)
// ============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'appointment-1' }) };
});

const mockOystehrZambda = { zambda: { execute: vi.fn() } };
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: mockOystehrZambda, oystehr: undefined }),
}));

let mockIsReadOnly = false;
vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: mockIsReadOnly }),
}));

vi.mock('../../src/features/visits/shared/components/vitals/hooks/useScreenDimensions', () => ({
  useScreenDimensions: () => ({ isLargeScreen: true }),
}));

vi.mock('../../src/features/visits/shared/components/vitals/hooks/useVitalsSaveOnEnter', () => ({
  useVitalsSaveOnEnter: () => ({ handleKeyDown: vi.fn() }),
}));

// History list pulls in a large dependency tree we don't exercise here — stub it out.
vi.mock('../../src/features/visits/shared/components/vitals/components/VitalsHistoryContainer', () => ({
  default: () => <div data-testid="history-container-stub" />,
}));
vi.mock('../../src/features/visits/shared/components/vitals/components/VitalsHistoryEntry', () => ({
  default: () => <div data-testid="history-entry-stub" />,
}));

// The uploader owns the Z3/scanner widgets, irrelevant to the card wiring under test.
vi.mock('../../src/features/visits/shared/components/vitals/vision/DotVisionDocumentUploader', () => ({
  default: () => <div data-testid="dot-uploader-stub" />,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { dataTestIds } from '../../src/constants/data-test-ids';
import { VisionLocalState } from '../../src/features/visits/shared/components/vitals/types';
import { useDotVisionScreeningLocalState } from '../../src/features/visits/shared/components/vitals/vision/useDotVisionScreeningLocalState';
import VitalsVisionCard from '../../src/features/visits/shared/components/vitals/vision/VitalsVisionCard';

// ============================================================================
// FIXTURES
// ============================================================================

const makeVisionLocalState = (): VisionLocalState => ({
  leftEyeSelection: '',
  rightEyeSelection: '',
  bothEyesSelection: '',
  isChildTooYoungSelected: false,
  isWithGlassesSelected: false,
  isWithoutGlassesSelected: false,
  validationError: false,
  isLeftEyeInvalid: false,
  isRightEyeInvalid: false,
  isDisabled: false,
  hasData: false,
  isValid: false,
  handleLeftEyeChange: vi.fn(),
  handleRightEyeChange: vi.fn(),
  handleBothEyesChange: vi.fn(),
  handleVisionOptionChange: vi.fn(),
  setValidationError: vi.fn(),
  clearForm: vi.fn(),
  getDTO: vi.fn(() => null),
});

// The DOT sub-form state now lives in useVitalsManagement and is passed to the card via `field`.
// A tiny harness supplies a REAL dotState instance (so validation/enablement behave like production)
// plus a spy `saveDot` so we can assert the card delegates saving to the shared handler.
const Harness: FC<{ saveDot: () => Promise<void> }> = ({ saveDot }) => {
  const dotState = useDotVisionScreeningLocalState();
  const field: any = {
    save: vi.fn(),
    saveWithDto: vi.fn(),
    delete: vi.fn(),
    isSaving: false,
    isValid: false,
    hasData: false,
    current: [],
    historical: [],
    localState: makeVisionLocalState(),
    dotState,
    saveDot,
    isSavingDot: false,
  };
  return <VitalsVisionCard field={field} />;
};

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;
};

const leftFieldLabel = `${DOT_VISION_SCREENING_LABELS.horizontalFieldLeft} (degrees)`;

const expandDotSection = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByText('DOT Vision Screening'));
};

// ============================================================================
// TESTS
// ============================================================================

describe('VitalsVisionCard — DOT Vision Screening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReadOnly = false;
  });

  it('enables the DOT Add button once valid data is entered and delegates saving to field.saveDot', async () => {
    const user = userEvent.setup();
    const saveDot = vi.fn().mockResolvedValue(undefined);
    render(<Harness saveDot={saveDot} />, { wrapper: createWrapper() });

    await expandDotSection(user);

    const addButton = screen.getByTestId(dataTestIds.vitalsPage.dotVisionAddButton);
    expect(addButton).toBeDisabled();

    await user.type(screen.getByLabelText(leftFieldLabel), '95');
    expect(addButton).toBeEnabled();

    await user.click(addButton);
    await waitFor(() => expect(saveDot).toHaveBeenCalledTimes(1));
  });

  it('keeps the Add button disabled and flags the field for out-of-range degrees', async () => {
    const user = userEvent.setup();
    const saveDot = vi.fn().mockResolvedValue(undefined);
    render(<Harness saveDot={saveDot} />, { wrapper: createWrapper() });

    await expandDotSection(user);

    // 200° exceeds the 0–180 range: the field is flagged and the entry is not saveable.
    await user.type(screen.getByLabelText(leftFieldLabel), '200');
    expect(screen.getByTestId(dataTestIds.vitalsPage.dotVisionAddButton)).toBeDisabled();

    // A negative angle is likewise rejected.
    await user.clear(screen.getByLabelText(leftFieldLabel));
    await user.type(screen.getByLabelText(leftFieldLabel), '-5');
    expect(screen.getByTestId(dataTestIds.vitalsPage.dotVisionAddButton)).toBeDisabled();
    expect(saveDot).not.toHaveBeenCalled();
  });

  it('accepts an in-range boundary value (180°)', async () => {
    const user = userEvent.setup();
    const saveDot = vi.fn().mockResolvedValue(undefined);
    render(<Harness saveDot={saveDot} />, { wrapper: createWrapper() });

    await expandDotSection(user);
    await user.type(screen.getByLabelText(leftFieldLabel), '180');
    expect(screen.getByTestId(dataTestIds.vitalsPage.dotVisionAddButton)).toBeEnabled();
  });

  it('hides the DOT editing UI for a read-only appointment', async () => {
    mockIsReadOnly = true;
    const saveDot = vi.fn().mockResolvedValue(undefined);
    render(<Harness saveDot={saveDot} />, { wrapper: createWrapper() });

    expect(screen.queryByText('DOT Vision Screening')).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.vitalsPage.dotVisionAddButton)).not.toBeInTheDocument();
  });
});
