import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { cancelBillingClaimTask, retryBillingClaimTask } from '../../src/api/api';
import { CancelTaskButton, RetryTaskButton } from '../../src/pages/ClaimCreationQueue';
vi.mock('../../src/api/api', () => ({
  retryBillingClaimTask: vi.fn().mockResolvedValue({}),
  cancelBillingClaimTask: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

it('retries the selected task and refreshes the queue', async () => {
  const onRetried = vi.fn();
  render(<RetryTaskButton taskId="task-1" onRetried={onRetried} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(retryBillingClaimTask).toHaveBeenCalledWith({}, { taskId: 'task-1' }));
  await waitFor(() => expect(onRetried).toHaveBeenCalledOnce());
});

it('cancels the selected task and refreshes the queue', async () => {
  const onCanceled = vi.fn();
  render(<CancelTaskButton taskId="task-1" onCanceled={onCanceled} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(cancelBillingClaimTask).toHaveBeenCalledWith({}, { taskId: 'task-1' }));
  await waitFor(() => expect(onCanceled).toHaveBeenCalledOnce());
});
