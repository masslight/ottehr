import { BillingClaimsExportStatusResponse } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { pollExportTask } from '../../src/utils/pollExportTask';

const status = (value: BillingClaimsExportStatusResponse['status']): BillingClaimsExportStatusResponse => ({
  status: value,
});

const poll = (
  checkStatus: () => Promise<BillingClaimsExportStatusResponse>
): Promise<BillingClaimsExportStatusResponse> =>
  pollExportTask({
    checkStatus,
    intervalMs: 1,
    timeoutMs: 10,
  });

describe('pollExportTask', () => {
  it('asks once before waiting at all', async () => {
    const result = await pollExportTask({
      checkStatus: vi.fn().mockResolvedValue({
        status: 'completed',
        downloadUrl: 'https://signed.example/claims.csv',
      }),
      intervalMs: 60_000,
      timeoutMs: 60_000,
    });

    expect(result.status).toBe('completed');
  });

  it('waits for the export to finish before resolving', async () => {
    const checkStatus = vi
      .fn()
      .mockResolvedValueOnce(status('requested'))
      .mockResolvedValueOnce(status('in-progress'))
      .mockResolvedValue({
        status: 'completed',
        downloadUrl: 'https://signed.example/claims.csv',
      });

    const result = await poll(checkStatus);

    expect(checkStatus).toHaveBeenCalledTimes(3);
    expect(result.downloadUrl).toBe('https://signed.example/claims.csv');
  });

  it('resolves on failure so the caller can report why', async () => {
    const result = await poll(
      vi.fn().mockResolvedValue({
        status: 'failed',
        error: 'payer lookup timed out',
      })
    );

    expect(result).toEqual({ status: 'failed', error: 'payer lookup timed out' });
  });

  // An unrecognized Task status must not read as an outcome, or the page would claim success.
  it('keeps waiting on a status it does not recognize', async () => {
    await expect(poll(vi.fn().mockResolvedValue({ status: 'on-hold' }))).rejects.toThrow('Export timed out');
  });

  it('gives up once the export has had long enough', async () => {
    const checkStatus = vi.fn().mockResolvedValue(status('in-progress'));

    await expect(poll(checkStatus)).rejects.toThrow('Export timed out');
    expect(checkStatus).toHaveBeenCalledTimes(10);
  });

  it('lets a failed status check surface instead of retrying forever', async () => {
    await expect(poll(vi.fn().mockRejectedValue(new Error('network down')))).rejects.toThrow('network down');
  });
});
