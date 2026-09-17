import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { retryBillingClaimTask } from '../../src/api/api';
import { RetryTaskButton } from '../../src/pages/ClaimCreationQueue';
vi.mock('../../src/api/api', () => ({ retryBillingClaimTask: vi.fn().mockResolvedValue({}) }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
it('retries the selected task and refreshes the queue', async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <RetryTaskButton taskId="task-1" />
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(retryBillingClaimTask).toHaveBeenCalledWith({}, { taskId: 'task-1' }));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['billing-claim-tasks'] }));
});
