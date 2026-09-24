import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { retryBillingClaimTask } from '../../src/api/api';
import { RetryTaskButton } from '../../src/pages/ClaimCreationQueue';
vi.mock('../../src/api/api', () => ({ retryBillingClaimTask: vi.fn().mockResolvedValue({}) }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
it('retries the selected task and refreshes the queue', async () => {
  const onRetried = vi.fn();
  render(<RetryTaskButton taskId="task-1" onRetried={onRetried} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(retryBillingClaimTask).toHaveBeenCalledWith({}, { taskId: 'task-1' }));
  await waitFor(() => expect(onRetried).toHaveBeenCalledOnce());
});
