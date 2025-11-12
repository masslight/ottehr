import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import moment from 'moment';
import { FC, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchReports, getReportDownloadUrl } from '../../../../packages/zambdas/src/services/reports';
import { GenerateReportModal } from './GenerateReportModal';
import { RoundedButton } from './RoundedButton';

interface Report {
  id: string;
  type: string;
  dateGenerated: string;
  reportType?: string;
  createdAt?: string;
  path?: string;
}

export const PatientReportsTab: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [openGenerateReport, setOpenGenerateReport] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const loadReports = useCallback(async (): Promise<void> => {
    if (!id) return;

    const { reports: fetchedReports, total } = await fetchReports(
      id,
      paginationModel.page + 1,
      paginationModel.pageSize
    );

    const transformed = fetchedReports.map((r) => {
      const start = r.startDate ? moment(new Date(r.startDate)).format('L h:mm:ss A') : '-';
      const end = r.endDate ? moment(new Date(r.endDate)).format('L h:mm:ss A') : '-';
      const generated = r.createdAt ? moment(new Date(r.createdAt)).format('L h:mm:ss A') : '-';

      return {
        id: r.id,
        reportFileFormat: r.reportFileFormat === 'csv' ? 'CSV' : 'PDF',
        type: r.reportType === 'vitals' ? 'Vital' : 'Time',
        startDate: start,
        endDate: end,
        dateGenerated: generated,
        reportType: r.reportType,
        createdAt: generated,
        path: r.path,
      };
    });

    setReports(transformed);
    setRowCount(total);
  }, [id, paginationModel.page, paginationModel.pageSize, setReports, setRowCount]);

  useEffect((): void => {
    void loadReports();
  }, [loadReports]);

  const columns: GridColDef<Report>[] = [
    { field: 'reportFileFormat', headerName: 'Format', width: 250, sortable: false },
    { field: 'type', headerName: 'Type', width: 250, sortable: false },
    { field: 'startDate', headerName: 'Start Date', width: 250, sortable: false },
    { field: 'endDate', headerName: 'End Date', width: 250, sortable: false },
    { field: 'createdAt', headerName: 'Generation Date', width: 250, sortable: false },
    {
      field: 'action',
      headerName: 'Action',
      sortable: false,
      width: 100,
      renderCell: (params) => (
        <IconButton
          color="primary"
          onClick={async () => {
            if (params.row.id) {
              const signedUrl = await getReportDownloadUrl(params.row.path || '');
              if (signedUrl) {
                window.open(signedUrl, '_blank');
              } else {
                console.error('Failed to get download URL');
              }
            }
          }}
        >
          <DownloadIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
          Reports
        </Typography>

        <RoundedButton
          onClick={() => setOpenGenerateReport(true)}
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
        >
          Generate Report
        </RoundedButton>
      </Box>

      <DataGridPro
        rows={reports}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        disableColumnMenu
        disableRowSelectionOnClick
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pagination
        pageSizeOptions={[5, 10]}
        rowCount={rowCount}
        paginationMode="server"
        sx={{
          width: '100%',
          border: 0,
          '.MuiDataGrid-columnHeaderTitle': {
            fontWeight: 500,
          },
        }}
      />

      <GenerateReportModal
        loadReports={loadReports}
        patientId={id!}
        open={openGenerateReport}
        onClose={() => setOpenGenerateReport(false)}
      />
    </Paper>
  );
};
