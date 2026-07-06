import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DOT_VISION_SCREENING_LABELS, VitalsVisionObservationDTO } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS (must precede the component import)
// ============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'appointment-1' }) };
});

const mockUploadDotVisionDocument = vi.fn();
vi.mock('src/api/api', () => ({
  uploadDotVisionDocument: (...args: any[]) => mockUploadDotVisionDocument(...args),
}));

const mockOystehrZambda = { zambda: { execute: vi.fn() } };
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: mockOystehrZambda }),
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

// The uploader owns the Z3/scanner widgets; stub it so we can drive the "file attached" state and
// assert the lazy-DocumentReference contract that lives in VitalsVisionCard.handleSaveDot.
vi.mock('../../src/features/visits/shared/components/vitals/vision/DotVisionDocumentUploader', () => ({
  default: ({ onUploaded, onRemove }: any) => (
    <div>
      <button type="button" onClick={() => onUploaded({ url: 'z3://referral.pdf', title: 'referral.pdf' })}>
        stub-attach-file
      </button>
      <button type="button" onClick={onRemove}>
        stub-remove-file
      </button>
    </div>
  ),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { dataTestIds } from '../../src/constants/data-test-ids';
import { VisionLocalState } from '../../src/features/visits/shared/components/vitals/types';
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

const makeVisionField = (overrides: Partial<ReturnType<typeof baseField>> = {}): any => ({
  ...baseField(),
  ...overrides,
});

const baseField = (): any => ({
  save: vi.fn().mockResolvedValue(undefined),
  saveWithDto: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  isSaving: false,
  isValid: false,
  hasData: false,
  current: [],
  historical: [],
  localState: makeVisionLocalState(),
});

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;
};

const leftFieldLabel = `${DOT_VISION_SCREENING_LABELS.horizontalFieldLeft} (degrees)`;

// Expands the collapsed "DOT Vision Screening" sub-section.
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
    mockUploadDotVisionDocument.mockResolvedValue({
      documentRefId: 'created-doc-ref',
      url: 'z3://referral.pdf',
      title: 'referral.pdf',
    });
  });

  it('keeps the DOT Add button disabled until data is entered, then saves a correctly-shaped DTO', async () => {
    const user = userEvent.setup();
    const field = makeVisionField();
    render(<VitalsVisionCard field={field} />, { wrapper: createWrapper() });

    await expandDotSection(user);

    const addButton = screen.getByTestId(dataTestIds.vitalsPage.dotVisionAddButton);
    expect(addButton).toBeDisabled();

    await user.type(screen.getByLabelText(leftFieldLabel), '95');
    expect(addButton).toBeEnabled();

    await user.click(addButton);

    await waitFor(() => expect(field.saveWithDto).toHaveBeenCalledTimes(1));
    const savedDto = field.saveWithDto.mock.calls[0][0] as VitalsVisionObservationDTO;
    expect(savedDto.field).toBe('vital-vision');
    expect(savedDto.dotVisionScreening?.horizontalFieldLeftDegrees).toBe(95);
    // A DOT-only entry must not carry acuity text.
    expect(savedDto.leftEyeVisionText).toBe('');
    // No document was attached → the upload zambda must not be called.
    expect(mockUploadDotVisionDocument).not.toHaveBeenCalled();

    // Form resets after a successful save.
    await waitFor(() => expect(screen.getByLabelText(leftFieldLabel)).toHaveValue(null));
  });

  it('lazily creates the DocumentReference on save and embeds its id in the saved DTO', async () => {
    const user = userEvent.setup();
    const field = makeVisionField();
    render(<VitalsVisionCard field={field} />, { wrapper: createWrapper() });

    await expandDotSection(user);

    // Answer "Yes" to "Received documentation…" (4th Yes/No row) to reveal the uploader.
    const yesRadios = screen.getAllByLabelText('Yes');
    await user.click(yesRadios[3]);

    // Attach a file: this only stores a session-local pending doc (no DocumentReference yet).
    await user.click(screen.getByText('stub-attach-file'));
    expect(mockUploadDotVisionDocument).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(dataTestIds.vitalsPage.dotVisionAddButton));

    // On save, the DocumentReference is created exactly once, from the pending Z3 file.
    await waitFor(() => expect(mockUploadDotVisionDocument).toHaveBeenCalledTimes(1));
    expect(mockUploadDotVisionDocument).toHaveBeenCalledWith(mockOystehrZambda, {
      appointmentID: 'appointment-1',
      z3URL: 'z3://referral.pdf',
      title: 'referral.pdf',
    });

    const savedDto = field.saveWithDto.mock.calls[0][0] as VitalsVisionObservationDTO;
    expect(savedDto.dotVisionScreening?.receivedDocumentation).toBe(true);
    expect(savedDto.dotVisionScreening?.document).toEqual({
      documentReferenceId: 'created-doc-ref',
      url: 'z3://referral.pdf',
      title: 'referral.pdf',
    });
  });

  it('does not call the upload zambda when an attached file is removed before saving', async () => {
    const user = userEvent.setup();
    const field = makeVisionField();
    render(<VitalsVisionCard field={field} />, { wrapper: createWrapper() });

    await expandDotSection(user);
    await user.click(screen.getAllByLabelText('Yes')[3]);
    await user.click(screen.getByText('stub-attach-file'));
    await user.click(screen.getByText('stub-remove-file'));

    await user.click(screen.getByTestId(dataTestIds.vitalsPage.dotVisionAddButton));

    await waitFor(() => expect(field.saveWithDto).toHaveBeenCalledTimes(1));
    // File was removed → no DocumentReference is created and the saved DTO has no document.
    expect(mockUploadDotVisionDocument).not.toHaveBeenCalled();
    const savedDto = field.saveWithDto.mock.calls[0][0] as VitalsVisionObservationDTO;
    expect(savedDto.dotVisionScreening?.document).toBeUndefined();
  });

  it('hides the DOT editing UI for a read-only appointment', async () => {
    mockIsReadOnly = true;
    const field = makeVisionField();
    render(<VitalsVisionCard field={field} />, { wrapper: createWrapper() });

    expect(screen.queryByText('DOT Vision Screening')).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.vitalsPage.dotVisionAddButton)).not.toBeInTheDocument();
  });
});
