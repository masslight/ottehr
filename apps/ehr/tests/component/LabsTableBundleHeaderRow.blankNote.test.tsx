import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({
  updateLabOrderResources: vi.fn().mockResolvedValue({}),
}));

import type Oystehr from '@oystehr/sdk';
import { updateLabOrderResources } from 'src/api/api';
import { LabsTableBundleHeaderRow } from '../../src/features/external-labs/components/labs-orders/LabsTableBundleHeaderRow';

const renderRow = (): void => {
  render(
    <table>
      <tbody>
        <LabsTableBundleHeaderRow
          columnsLen={5}
          orderBundleName="Quest"
          showSubmitButton
          pendingLabsLen={0}
          submitLoading={false}
          abnPdfUrl={undefined}
          orderPdfUrl={undefined}
          submitOrders={vi.fn()}
          refetchLabOrders={vi.fn().mockResolvedValue(undefined)}
          oystehr={{} as Oystehr}
          requisitionNumber="REQ-1"
        />
      </tbody>
    </table>
  );
};

const typeNoteAndSave = async (note: string): Promise<void> => {
  const user = userEvent.setup();
  renderRow();
  await user.click(screen.getByRole('button', { name: /add order level note/i }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByRole('textbox'), note);
  await user.click(within(dialog).getByRole('button', { name: 'Save note' }));
};

describe('LabsTableBundleHeaderRow add order level note', () => {
  beforeEach(() => {
    vi.mocked(updateLabOrderResources).mockClear();
  });

  it('does not save a whitespace-only note and asks for a note', async () => {
    await typeNoteAndSave('   ');

    expect(updateLabOrderResources).not.toHaveBeenCalled();
    expect(screen.getByText('Please enter a note.')).toBeInTheDocument();
  });

  it('saves a note with surrounding spaces as typed', async () => {
    await typeNoteAndSave(' call first ');

    expect(updateLabOrderResources).toHaveBeenCalledWith(expect.anything(), {
      event: 'addOrderLevelNote',
      requisitionNumber: 'REQ-1',
      note: ' call first ',
    });
  });
});
