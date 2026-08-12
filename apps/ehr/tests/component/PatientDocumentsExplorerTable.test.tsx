import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// The real grid virtualizes on measured width, which jsdom reports as zero; render the row cells
// directly so the actions column is exercised.
vi.mock('@mui/x-data-grid-pro', () => ({
  DataGridPro: ({ rows, columns }: { rows: any[]; columns: any[] }) => (
    <div>
      {rows.map((row) => (
        <div key={row.id}>
          {columns.map((column) => (
            <span key={column.field}>{column.renderCell?.({ row }) as ReactNode}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

import {
  DocumentTableActions,
  PatientDocumentsExplorerTable,
} from '../../src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable';
import { PatientDocumentInfo } from '../../src/hooks/useGetPatientDocs';

const makeDocument = (id: string, fileName: string): PatientDocumentInfo => ({
  id,
  docName: fileName,
  whenAddedDate: '2026-05-05T00:00:00.000Z',
  attachments: [{ title: fileName, z3Url: `https://z3.example/${fileName}` }],
});

const makeActions = (overrides: Partial<DocumentTableActions> = {}): DocumentTableActions => ({
  isActionAllowed: () => true,
  onDocumentDownload: vi.fn().mockResolvedValue(undefined),
  onDocumentFax: vi.fn(),
  onDocumentRename: vi.fn().mockResolvedValue(undefined),
  onDocumentDelete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const renderTable = (documents: PatientDocumentInfo[], actions: DocumentTableActions): void => {
  render(<PatientDocumentsExplorerTable isLoadingDocs={false} documents={documents} documentTableActions={actions} />);
};

describe('PatientDocumentsExplorerTable', () => {
  it('faxes the row the user picked', async () => {
    const onDocumentFax = vi.fn();
    const user = userEvent.setup();
    renderTable([makeDocument('doc-1', 'visit-note.pdf')], makeActions({ onDocumentFax }));

    await user.click(screen.getByRole('button', { name: 'Send Fax' }));

    expect(onDocumentFax).toHaveBeenCalledWith('doc-1');
  });

  it('offers the fax action only for documents a fax can carry', () => {
    renderTable(
      [makeDocument('doc-1', 'visit-note.pdf'), makeDocument('doc-2', 'medical_record_black_oliver.zip')],
      makeActions()
    );

    // The generated medical-record archive would fail as "nothing faxable", so it offers no fax.
    expect(screen.getAllByRole('button', { name: 'Send Fax' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Download' })).toHaveLength(2);
  });

  it('hides the fax action when the caller disallows it', () => {
    renderTable(
      [makeDocument('doc-1', 'visit-note.pdf')],
      makeActions({ isActionAllowed: (_id, actionType) => actionType !== 'ActionFax' })
    );

    expect(screen.queryByRole('button', { name: 'Send Fax' })).not.toBeInTheDocument();
  });
});
