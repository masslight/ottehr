import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { FC, useState } from 'react';
import { GenerateReportModal } from './GenerateReportModal';
import { RoundedButton } from './RoundedButton';

interface Report {
  id: string;
  name: string;
  type: string;
  dateGenerated: string;
}

export const PatientReportsTab: FC = () => {
  const [openGenerateReport, setOpenGenerateReport] = useState(false);
  const [reports] = useState<Report[]>([
    {
      id: '1',
      name: 'Vitals Report - Mar 2025',
      type: 'Vitals',
      dateGenerated: '12/31/2018 9:36:00 PM',
    },
    {
      id: '2',
      name: 'Vitals Report - Feb 2025',
      type: 'Vitals',
      dateGenerated: '12/31/2018 9:36:00 PM',
    },
    {
      id: '3',
      name: 'Vitals Report - Jan 2025',
      type: 'Vitals',
      dateGenerated: '12/31/2018 9:36:00 PM',
    },
    {
      id: '4',
      name: 'Time Report - Feb 2025',
      type: 'Time',
      dateGenerated: '12/31/2018 9:36:00 PM',
    },
    {
      id: '5',
      name: 'Time Report - Jan 2025',
      type: 'Time',
      dateGenerated: '12/31/2018 9:36:00 PM',
    },
  ]);

  const columns: GridColDef<Report>[] = [
    { field: 'name', headerName: 'Report Name', width: 350, sortable: false },
    { field: 'type', headerName: 'Report Type', width: 350, sortable: false },
    { field: 'dateGenerated', headerName: 'Date Generated', width: 350, sortable: false },
    {
      field: 'action',
      headerName: 'Action',
      sortable: false,
      width: 100,
      renderCell: () => (
        <IconButton color="primary">
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

        <RoundedButton
          onClick={() => console.log('Open Settings')}
          variant="contained"
          startIcon={<SettingsIcon fontSize="small" />}
        >
          Settings
        </RoundedButton>
      </Box>

      <DataGridPro
        rows={reports}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        disableColumnMenu
        disableRowSelectionOnClick
        hideFooter
        sx={{
          width: '100%',
          border: 0,
          '.MuiDataGrid-columnHeaderTitle': {
            fontWeight: 500,
          },
        }}
      />
      <GenerateReportModal open={openGenerateReport} onClose={() => setOpenGenerateReport(false)} />
    </Paper>
  );
};
