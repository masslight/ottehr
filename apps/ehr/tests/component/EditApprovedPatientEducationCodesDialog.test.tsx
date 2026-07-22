import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditApprovedPatientEducationCodesDialog } from 'src/features/admin/patient-education/EditApprovedPatientEducationCodesDialog';
import { ApprovedPatientEducationItem } from 'utils';
import { describe, expect, it, vi } from 'vitest';

const updateApprovedPatientEducationCodes = vi.fn();

vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({
    updateApprovedPatientEducationCodes,
  }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useICD10SearchNew: () => ({
    data: { codes: [] },
    isFetching: false,
  }),
}));

vi.mock('src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({
    debounce: (callback: () => void) => callback(),
  }),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const item: ApprovedPatientEducationItem = {
  documentReferenceId: 'doc-ref-1',
  title: 'Patient Education: Example',
  icdCodes: [],
  pdfPresignedUrl: 'https://example.com/doc.pdf',
  language: 'en',
};

describe('EditApprovedPatientEducationCodesDialog', () => {
  it('shows an inline required error when saving without a diagnosis', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <EditApprovedPatientEducationCodesDialog open onClose={vi.fn()} item={item} />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(updateApprovedPatientEducationCodes).not.toHaveBeenCalled();
  });
});
