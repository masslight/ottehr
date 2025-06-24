// import ErrorIcon from '@mui/icons-material/Error';
import DownloadIcon from '@mui/icons-material/Download';
import { IconButton, useTheme } from '@mui/material';
import { Box } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
import { FC, useCallback, useMemo } from 'react';
import { formatISOStringToDateAndTime } from '../../../helpers/formatDateTime';
import { PatientDocumentInfo } from '../../../hooks/useGetPatientDocs';

export enum DocumentTableActionType {
  ActionDownload = 'ActionDownload',
}

export type DocumentTableActions = {
  isActionAllowed: (documentId: string, actionType: DocumentTableActionType) => boolean;
  onDocumentDownload: (documentId: string) => Promise<void>;
};

const DocActionsCell: FC<{ docInfo: PatientDocumentInfo; actions: DocumentTableActions }> = ({ docInfo, actions }) => {
  const { isActionAllowed, onDocumentDownload } = actions;
  const theme = useTheme();
  const lineColor = theme.palette.primary.main;

  const handleDocDownload = useCallback(async (): Promise<void> => {
    await onDocumentDownload(docInfo.id);
  }, [docInfo.id, onDocumentDownload]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {/* <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
        TODO
      </Typography>
      DownloadIcon
      <ErrorIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', color: lineColor }} /> */}

      {isActionAllowed(docInfo.id, DocumentTableActionType.ActionDownload) && (
        <IconButton aria-label="Download" onClick={handleDocDownload}>
          <DownloadIcon fontSize="small" sx={{ verticalAlign: 'middle', color: lineColor }} />
        </IconButton>
      )}

      {/* {isActionAllowed(docInfo.id, DocumentTableActionType.ActionDownload) && (
        <IconButton aria-label="Download" onClick={() => onDocumentDownload(docInfo.id)}>
          <DownloadIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: 'middle', color: lineColor }} />
        </IconButton>
      )} */}
    </Box>
  );
};

const configureTableColumns = (actions: DocumentTableActions): GridColDef<PatientDocumentInfo>[] => {
  return [
    {
      sortable: false,
      field: 'docName',
      headerName: 'Doc Name',
      width: 400,
      renderCell: ({ row: { docName } }) => docName,
    },
    {
      sortComparator: (a, b) => {
        console.log(`[When added] sortComparator() a=${a} :: b=${b}`);
        const createdA = DateTime.fromISO(a ?? '');
        const createdB = DateTime.fromISO(b ?? '');
        return createdA.diff(createdB).milliseconds;
      },
      sortable: true,
      field: 'whenAddedDate',
      headerName: 'When added',
      width: 150,
      renderCell: ({ row: { whenAddedDate } }) => (whenAddedDate ? formatISOStringToDateAndTime(whenAddedDate) : '-'),
    },
    {
      sortable: true,
      field: 'whoAdded',
      headerName: 'Who added',
      width: 150,
      renderCell: ({ row: { whoAdded } }) => whoAdded ?? '-',
    },
    {
      sortable: false,
      field: 'actions',
      headerName: 'Action',
      width: 150,
      renderCell: ({ row }) => <DocActionsCell docInfo={row} actions={actions} />,
    },
  ];
};

export type PatientDocumentsExplorerTableProps = {
  isLoadingDocs: boolean;
  documents?: PatientDocumentInfo[];
  documentTableActions: DocumentTableActions;
};

export const PatientDocumentsExplorerTable: FC<PatientDocumentsExplorerTableProps> = (props) => {
  const { isLoadingDocs, documents, documentTableActions } = props;

  const filteredDocs = documents ?? [];

  const tableColumns = useMemo(() => {
    return configureTableColumns(documentTableActions);
  }, [documentTableActions]);

  return (
    <DataGridPro
      rows={filteredDocs}
      columns={tableColumns}
      initialState={{
        pagination: {
          paginationModel: {
            pageSize: 10,
          },
        },
        sorting: {
          sortModel: [{ field: 'whenAdded', sort: 'desc' }],
        },
      }}
      autoHeight
      loading={isLoadingDocs}
      pagination
      disableColumnMenu
      pageSizeOptions={[10]}
      disableRowSelectionOnClick
      sx={{
        border: 0,
        '.MuiDataGrid-columnHeaderTitle': {
          fontWeight: 500,
        },
      }}
    />
  );
};
