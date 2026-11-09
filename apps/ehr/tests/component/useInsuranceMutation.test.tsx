import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
const clients = { oystehr: undefined, oystehrZambda: { zambda: { execute } } };
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => clients,
}));

import { useInsuranceMutation } from '../../src/features/visits/telemed/components/admin/admin.queries';

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const executedIds = (): string[] => execute.mock.calls.map(([params]) => `${params.id}:${params.listName}`);

describe('useInsuranceMutation blank text', () => {
  beforeEach(() => {
    execute.mockReset();
    execute.mockResolvedValue({});
  });

  it('removes an existing note when the new note is only whitespace', async () => {
    const { result } = renderHook(() => useInsuranceMutation('payer-1'), { wrapper });

    await result.current.mutateAsync({ existingNote: 'Old note', note: ' \n ', showInPaperwork: false });

    expect(executedIds()).toEqual([
      'remove-payer-from-insurance-override-list:patient',
      'remove-payer-from-insurance-override-list:ehr',
    ]);
  });

  it('does not add a note that is only whitespace', async () => {
    const { result } = renderHook(() => useInsuranceMutation('payer-1'), { wrapper });

    await result.current.mutateAsync({ note: '\n', showInPaperwork: false });

    expect(executedIds()).toEqual(['remove-payer-from-insurance-override-list:patient']);
  });

  it('sends a trimmed note when it changes', async () => {
    const { result } = renderHook(() => useInsuranceMutation('payer-1'), { wrapper });

    await result.current.mutateAsync({ existingNote: 'Old note', note: ' New note\n', showInPaperwork: false });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'edit-payer-in-insurance-override-list', listName: 'ehr', payerNote: 'New note' })
    );
  });

  it('does not add a display name that is only whitespace', async () => {
    const { result } = renderHook(() => useInsuranceMutation('payer-1'), { wrapper });

    await result.current.mutateAsync({ name: '   ', showInPaperwork: true });

    expect(execute).not.toHaveBeenCalled();
  });

  it('does not rewrite an unchanged display name that only gained surrounding spaces', async () => {
    const { result } = renderHook(() => useInsuranceMutation('payer-1'), { wrapper });

    await result.current.mutateAsync({ existingName: 'Acme', name: ' Acme ', showInPaperwork: true });

    expect(execute).not.toHaveBeenCalled();
  });
});
