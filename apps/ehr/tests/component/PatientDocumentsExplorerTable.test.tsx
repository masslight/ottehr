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
import { PatientDocumentAttachment, PatientDocumentInfo } from '../../src/hooks/useGetPatientDocs';

const makeDocument = (
  id: string,
  fileName: string,
  typeCodes?: string[],
  attachment: Partial<PatientDocumentAttachment> = {}
): PatientDocumentInfo => ({
  id,
  typeCodes,
  docName: fileName,
  whenAddedDate: '2026-05-05T00:00:00.000Z',
  attachments: [{ title: fileName, z3Url: `https://z3.example/${fileName}`, ...attachment }],
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
      [
        makeDocument('doc-1', 'visit-note.pdf'),
        makeDocument('doc-2', 'medical_record_black_oliver.zip', ['medical-record-export']),
        makeDocument('doc-3', 'FaxPacket.pdf', ['fax-packet']),
      ],
      makeActions()
    );

    // Generated archives and prior fax packets are audit/export artifacts, not new source documents.
    expect(screen.getAllByRole('button', { name: 'Send Fax' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Download' })).toHaveLength(3);
  });

  it('offers the fax action on the stored content type when the URL has no extension', () => {
    renderTable(
      [makeDocument('doc-1', 'scan', undefined, { z3Url: 'https://z3.example/scan', contentType: 'image/png' })],
      makeActions()
    );

    expect(screen.getByRole('button', { name: 'Send Fax' })).toBeInTheDocument();
  });

  it('withholds the fax action when only the display title looks faxable', () => {
    // The server decides on the stored attachment, so a title that merely ends in .pdf must not
    // offer an action the send would then drop.
    renderTable(
      [makeDocument('doc-1', 'record.pdf', undefined, { z3Url: 'https://z3.example/record', contentType: undefined })],
      makeActions()
    );

    expect(screen.queryByRole('button', { name: 'Send Fax' })).not.toBeInTheDocument();
  });

  it('hides the fax action when the caller disallows it', () => {
    renderTable(
      [makeDocument('doc-1', 'visit-note.pdf')],
      makeActions({ isActionAllowed: (_id, actionType) => actionType !== 'ActionFax' })
    );

    expect(screen.queryByRole('button', { name: 'Send Fax' })).not.toBeInTheDocument();
  });
});
