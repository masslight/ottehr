import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME,
  INVOICEABLE_PATIENTS_REPORTS_FILE_NAME,
  InvoiceablePatientsReport,
} from 'utils';
import { invoiceablePatientsReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

export default function InvoiceablePatients(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda, oystehr } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<InvoiceablePatientsReport | null>(null);

  const handleBack = (): void => {
    navigate('/reports');
  };

  const fetchReport = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      if (!oystehrZambda || !oystehr) {
        throw new Error('Oystehr client not available');
      }

      const fileBuffer = await oystehr.z3.downloadFile({
        bucketName: INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME,
        'objectPath+': INVOICEABLE_PATIENTS_REPORTS_FILE_NAME,
      });
      const decoder = new TextDecoder('utf-8');
      const jsonString = decoder.decode(fileBuffer);
      const reports = JSON.parse(jsonString);

      setReportData(reports);
    } catch (err) {
      console.error('Error fetching visits overview report:', err);
      setError('Failed to load visits overview report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, oystehr]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const updateReport = async (): Promise<void> => {
    try {
      setLoading(true);
      if (!oystehrZambda) throw new Error('Oystehr client not available');
      await invoiceablePatientsReport(oystehrZambda);
      void fetchReport();
    } catch {
      enqueueSnackbar('Error occurred while updating invoiceable patients report. Please try again.', {
        variant: 'error',
      });
    }
  };

  const patientsReportsColumns: GridColDef[] = useMemo(
    () => [
      {
        field: 'patientName',
        headerName: 'Patient Name',
        flex: 1,
        sortable: true,
      },
      {
        field: 'patientDob',
        headerName: 'DOB',
        width: 180,
        sortable: true,
      },
      {
        field: 'appointmentDate',
        headerName: 'Appointment Date',
        width: 180,
        sortable: true,
      },
      {
        field: 'finalizationDate',
        headerName: 'Finalization Date',
        width: 180,
        sortable: true,
      },
      {
        field: 'responsiblePartyName',
        headerName: 'Responsible Party',
        flex: 1,
        sortable: true,
      },
      {
        field: 'amountInvoiceable',
        headerName: 'Amount',
        width: 100,
        sortable: true,
      },
      {
        field: 'candidClaimId',
        headerName: 'Candid ID',
        flex: 1,
        sortable: true,
      },
    ],
    []
  );
  const failedReportsColumns: GridColDef[] = useMemo(
    () => [
      {
        field: 'claimId',
        headerName: 'Claim Id',
        width: 400,
        sortable: true,
        renderCell: (params: any) => (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{params.value}</span>
            <Tooltip title="Copy claim id">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // prevent row selection
                  void navigator.clipboard
                    .writeText(params.value)
                    .then(() => enqueueSnackbar('Copied to clipboard', { variant: 'success' }));
                }}
              >
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          </div>
        ),
      },
      {
        field: 'error',
        headerName: 'Error message',
        flex: 1,
        sortable: true,
      },
    ],
    []
  );

  const patientsRows = useMemo(() => {
    if (!reportData?.patientsReports) return [];

    return reportData.patientsReports.map((patient) => ({
      id: patient.claimId,
      patientName: patient.name,
      patientDob: patient.dob,
      finalizationDate: patient.finalizationDate,
      appointmentDate: patient.appointmentDate,
      responsiblePartyName: patient.responsiblePartyName,
      amountInvoiceable: patient.amountInvoiceable,
      candidClaimId: patient.claimId,
    }));
  }, [reportData]);

  const failedReportsRows = useMemo(() => {
    if (!reportData?.failedReports) return [];

    return reportData.failedReports.map((patient) => ({
      id: patient.claimId,
      claimId: patient.claimId,
      error: patient.error,
    }));
  }, [reportData]);

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AssessmentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Visits Overview Report
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Pressing REFRESH button will create a new report, it can take some time, please be patient.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Button variant="outlined" onClick={() => void updateReport()} disabled={loading}>
          Refresh
        </Button>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && reportData && (
          <Typography variant="body1" sx={{ mb: 4 }}>
            Report was generated on: {reportData.date}
            <br /> Claims fetched from candid: {reportData.claimsFound}
            <br /> Claims in report: {reportData.patientsReports?.length}
          </Typography>
        )}

        {!loading && reportData && (
          <Box>
            {reportData && patientsRows.length > 0 && (
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Invoiceable Patients
                  </Typography>
                  <Box sx={{ height: 800, width: '100%' }}>
                    <DataGrid
                      rows={patientsRows}
                      columns={patientsReportsColumns}
                      initialState={{
                        pagination: {
                          paginationModel: { pageSize: 25 },
                        },
                      }}
                      pageSizeOptions={[25, 50, 100]}
                      rowBuffer={6}
                      sx={{
                        '& .MuiDataGrid-cell': {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                        '& .MuiDataGrid-columnHeaderTitle': {
                          fontWeight: 600,
                        },
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        )}

        {!loading && reportData && (
          <Box>
            {reportData && patientsRows.length > 0 && (
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Failed Reports
                  </Typography>
                  <Box sx={{ height: 800, width: '100%' }}>
                    <DataGrid
                      rows={failedReportsRows}
                      columns={failedReportsColumns}
                      initialState={{
                        pagination: {
                          paginationModel: { pageSize: 25 },
                        },
                      }}
                      pageSizeOptions={[25, 50, 100]}
                      rowBuffer={6}
                      sx={{
                        '& .MuiDataGrid-cell': {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                        '& .MuiDataGrid-columnHeaderTitle': {
                          fontWeight: 600,
                        },
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
