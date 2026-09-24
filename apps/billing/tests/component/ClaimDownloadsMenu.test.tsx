import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClaimDownloadsMenu } from '../../src/components/claim/ClaimDownloadsMenu';

const renderMenu = (
  claimType: string,
  buildingProof = false
): { onExportX12: () => void; onCms1500: () => void; onProofOfTimelyFiling: () => void } => {
  const handlers = { onExportX12: vi.fn(), onCms1500: vi.fn(), onProofOfTimelyFiling: vi.fn() };
  render(<ClaimDownloadsMenu claimType={claimType} buildingProof={buildingProof} {...handlers} />);
  return handlers;
};

const menuItems = (): (string | null)[] =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

describe('ClaimDownloadsMenu', () => {
  it('offers the X12 file, the CMS-1500 and the proof of timely filing for a professional claim', async () => {
    const user = userEvent.setup();
    const { onCms1500 } = renderMenu('professional');

    await user.click(screen.getByRole('button', { name: 'Downloads' }));
    expect(menuItems()).toEqual([
      'Export X12The 837P file',
      'CMS-1500Print or download the paper claim',
      'Proof of timely filingSubmission history as a PDF',
    ]);

    await user.click(screen.getByRole('menuitem', { name: /CMS-1500/ }));
    expect(onCms1500).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('leaves out the CMS-1500 for an institutional claim, whose X12 is an 837I', async () => {
    const user = userEvent.setup();
    const { onExportX12 } = renderMenu('institutional');

    await user.click(screen.getByRole('button', { name: 'Downloads' }));
    expect(menuItems()).toEqual(['Export X12The 837I file', 'Proof of timely filingSubmission history as a PDF']);

    await user.click(screen.getByRole('menuitem', { name: /export x12/i }));
    expect(onExportX12).toHaveBeenCalledTimes(1);
  });

  it('shows that the proof of timely filing is being put together', async () => {
    const user = userEvent.setup();
    renderMenu('professional', true);

    const button = screen.getByRole('button', { name: 'Downloads' });
    expect(within(button).getByRole('progressbar')).toBeInTheDocument();
    await user.click(button);
    expect(screen.getByRole('menuitem', { name: /proof of timely filing/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: /export x12/i })).not.toHaveAttribute('aria-disabled', 'true');
  });
});
