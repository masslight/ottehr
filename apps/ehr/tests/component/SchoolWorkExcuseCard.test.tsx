import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-appointment-id' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

const mockSetPartialChartData = vi.fn();
const mockChartDataSetState = vi.fn();
let mockChartData: Pick<GetChartDataResponse, 'schoolWorkNotes'> = {};

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({
    chartData: mockChartData,
    setPartialChartData: mockSetPartialChartData,
    chartDataSetState: mockChartDataSetState,
  }),
  useSaveChartData: vi.fn(),
  useDeleteChartData: vi.fn(),
  useAppointmentData: () => ({
    questionnaireResponse: {},
  }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({
    isAppointmentReadOnly: false,
  }),
}));

vi.mock('../../src/shared/hooks/useExcusePresignedFiles.ts', () => ({
  useExcusePresignedFiles: vi.fn(),
}));

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

import { SchoolWorkExcuseCard } from 'src/features/visits/shared/components/SchoolWorkExcuseCard';
import { GetChartDataResponse, SchoolWorkNoteExcuseDocFileDTO } from 'utils';
import {
  useDeleteChartData,
  useSaveChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';
import { useExcusePresignedFiles } from '../../src/shared/hooks/useExcusePresignedFiles';

// ============================================================================
// HELPERS
// ============================================================================

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('SchoolWorkExcuseCard', () => {
  let mockSaveMutate: ReturnType<typeof vi.fn>;
  let mockDeleteMutate: ReturnType<typeof vi.fn>;
  let capturedDeleteCallbacks: { onSuccess?: () => void; onError?: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChartData = {};
    capturedDeleteCallbacks = {};

    mockSaveMutate = vi.fn();

    mockDeleteMutate = vi.fn((data, callbacks) => {
      capturedDeleteCallbacks = callbacks || {};
    });

    vi.mocked(useExcusePresignedFiles).mockReset();
    vi.mocked(useExcusePresignedFiles).mockReturnValue([]);

    vi.mocked(useSaveChartData).mockReturnValue({
      mutate: mockSaveMutate,
      isPending: false,
    } as any);

    vi.mocked(useDeleteChartData).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);
  });

  describe('rendering', () => {
    it('should render create note button', () => {
      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      expect(screen.getByTestId('generate-school-free-button')).toBeInTheDocument();
    });

    it('should display existing unpublished notes', () => {
      const schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[] = [
        { name: 'My school note', id: 'note-1', type: 'school', date: new Date().toISOString(), published: false },
        { name: 'My work note', id: 'note-2', type: 'work', date: new Date().toISOString(), published: false },
      ];
      mockChartData = {
        schoolWorkNotes,
      };
      vi.mocked(useExcusePresignedFiles).mockReturnValue([...schoolWorkNotes]);

      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      expect(screen.getByText('My school note')).toBeInTheDocument();
      expect(screen.getByText('My work note')).toBeInTheDocument();
    });

    it('should not have notes if not in chart data', () => {
      mockChartData = {
        schoolWorkNotes: [], // No notes in chart data
      };
      vi.mocked(useExcusePresignedFiles).mockReturnValue([]); // No presigned files

      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      expect(() => screen.getByText('My school note')).toThrowError();
      expect(() => screen.getByText('My work note')).toThrowError();
    });

    it('should not have notes if not in presigned urls', () => {
      const schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[] = [
        { name: 'My school note', id: 'note-1', type: 'school', date: new Date().toISOString(), published: false },
        { name: 'My work note', id: 'note-2', type: 'work', date: new Date().toISOString(), published: false },
      ];
      mockChartData = {
        schoolWorkNotes,
      };
      vi.mocked(useExcusePresignedFiles).mockReturnValue([]); // No presigned files

      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      expect(() => screen.getByText('My school note')).toThrowError();
      expect(() => screen.getByText('My work note')).toThrowError();
    });

    it('unpublished notes should have publish/published button', () => {
      const schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[] = [
        { name: 'My school note', id: 'note-1', type: 'school', date: new Date().toISOString(), published: false },
        { name: 'My work note', id: 'note-2', type: 'work', date: new Date().toISOString(), published: true },
      ];
      mockChartData = {
        schoolWorkNotes,
      };
      vi.mocked(useExcusePresignedFiles).mockReturnValue([...schoolWorkNotes]);

      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      const publishSchoolButton = screen.getByTestId('publish-school-button');
      expect(publishSchoolButton).toBeInTheDocument();
      expect(publishSchoolButton).toHaveTextContent('Publish now');
      const publishWorkButton = screen.getByTestId('publish-work-button');
      expect(publishWorkButton).toBeInTheDocument();
      expect(publishWorkButton).toHaveTextContent('Published');
    });
  });

  describe('removing school note', () => {
    it('should call deleteChartData when removing', async () => {
      const user = userEvent.setup();
      const schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[] = [
        { name: 'My school note', id: 'note-1', type: 'school', date: new Date().toISOString(), published: false },
        { name: 'My work note', id: 'note-2', type: 'work', date: new Date().toISOString(), published: true },
      ];
      mockChartData = {
        schoolWorkNotes,
      };
      vi.mocked(useExcusePresignedFiles).mockReturnValue([...schoolWorkNotes]);

      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      const schoolDeleteButton = screen.getByTestId('school-delete-button');
      await user.click(schoolDeleteButton);

      expect(mockDeleteMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolWorkNotes: expect.arrayContaining([expect.objectContaining({ id: 'note-1', name: 'My school note' })]),
        }),
        expect.any(Object)
      );

      const workDeleteButton = screen.getByTestId('work-delete-button');
      await user.click(workDeleteButton);

      expect(mockDeleteMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolWorkNotes: expect.arrayContaining([expect.objectContaining({ id: 'note-2', name: 'My work note' })]),
        }),
        expect.any(Object)
      );
    });

    it('should clear local state when deleting', async () => {
      const user = userEvent.setup();
      const schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[] = [
        { name: 'My school note', id: 'note-1', type: 'school', date: new Date().toISOString(), published: false },
        { name: 'My work note', id: 'note-2', type: 'work', date: new Date().toISOString(), published: true },
      ];
      mockChartData = {
        schoolWorkNotes,
      };
      vi.mocked(useExcusePresignedFiles).mockReturnValue([...schoolWorkNotes]);

      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      const schoolDeleteButton = screen.getByTestId('school-delete-button');
      await user.click(schoolDeleteButton);

      expect(mockSetPartialChartData).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolWorkNotes: expect.toSatisfy(
            (notes: SchoolWorkNoteExcuseDocFileDTO[]): boolean =>
              notes.some((n) => n.id === 'note-2') && !notes.some((n) => n.id === 'note-1')
          ),
        }),
        { invalidateQueries: false }
      );
    });

    it('should show error and rollback on delete failure', async () => {
      const user = userEvent.setup();
      const schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[] = [
        { name: 'My school note', id: 'note-1', type: 'school', date: new Date().toISOString(), published: false },
        { name: 'My work note', id: 'note-2', type: 'work', date: new Date().toISOString(), published: true },
      ];
      mockChartData = {
        schoolWorkNotes,
      };
      vi.mocked(useExcusePresignedFiles).mockReturnValue([...schoolWorkNotes]);

      render(<SchoolWorkExcuseCard />, { wrapper: createWrapper() });

      const schoolDeleteButton = screen.getByTestId('school-delete-button');
      await user.click(schoolDeleteButton);

      // Simulate server error
      capturedDeleteCallbacks.onError?.();

      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.objectContaining({ variant: 'error' })
      );

      expect(mockSetPartialChartData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          schoolWorkNotes: schoolWorkNotes,
        })
      );
    });
  });
});
