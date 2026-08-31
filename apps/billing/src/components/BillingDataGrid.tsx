import { FileDownloadOutlined as FileDownloadOutlinedIcon } from '@mui/icons-material';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { DataGridProProps, GridPagination, GridToolbarExport } from '@mui/x-data-grid-pro';
import { ReactElement } from 'react';
import { otherColors } from '../themes/ottehr/colors';

export const dataGridSx = {
  bgcolor: 'background.paper',
  border: `1px solid ${otherColors.lightDivider}`,
  borderRadius: 1,
  fontSize: 14,
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#FAFAFA',
    borderBottom: `1px solid ${otherColors.lightDivider}`,
  },
  '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 500, fontSize: 13, color: 'text.secondary' },
  '& .MuiDataGrid-cell': {
    borderBottom: `1px solid ${otherColors.lightDivider}`,
    fontSize: 14,
    color: 'text.primary',
  },
  '& .MuiDataGrid-row': { cursor: 'pointer' },
  '& .MuiDataGrid-row:hover': { bgcolor: otherColors.apptHover },
} as const;

function NoRowsOverlay(): ReactElement {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <Typography color="text.secondary">No results found.</Typography>
    </Box>
  );
}

function LoadingOverlay(): ReactElement {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <CircularProgress size={32} />
    </Box>
  );
}

function CustomToolbar(props?: { fileName?: string }): ReactElement {
  return <GridToolbarExport csvOptions={{ fileName: props?.fileName ?? 'data-export' }} />;
}

function ExportCsvButton({ onExport, exporting }: { onExport: () => void; exporting?: boolean }): ReactElement {
  return (
    <Button
      size="small"
      startIcon={exporting ? <CircularProgress size={16} /> : <FileDownloadOutlinedIcon />}
      disabled={exporting}
      onClick={onExport}
    >
      Export
    </Button>
  );
}

export const dataGridSlots = (props?: {
  showCsvExport?: boolean;
  csvFileName?: string;
  onExportCsv?: () => void;
  exporting?: boolean;
}): DataGridProProps['slots'] => ({
  noRowsOverlay: NoRowsOverlay,
  loadingOverlay: LoadingOverlay,
  pagination: () => (
    <>
      {props?.onExportCsv ? <ExportCsvButton onExport={props.onExportCsv} exporting={props.exporting} /> : <></>}
      {props?.showCsvExport ? <CustomToolbar fileName={props?.csvFileName} /> : <></>}
      <GridPagination />
    </>
  ),
});
