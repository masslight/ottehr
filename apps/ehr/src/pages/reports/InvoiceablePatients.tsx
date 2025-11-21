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
import { GridRenderCellParams } from '@mui/x-data-grid-pro';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

      const fullBucketName = `${import.meta.env.VITE_APP_PROJECT_ID}-${INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME}`;
      const fileBuffer = await oystehr.z3.downloadFile({
        bucketName: fullBucketName,
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
    } finally {
      setLoading(false);
    }
  };

  const patientsReportsColumns: GridColDef[] = useMemo(
    () => [
      {
        field: 'patientName',
        headerName: 'Patient Name',
        width: 250,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => (
          <Link to={`/patient/${params.row.patientId}`} style={{ textDecoration: 'underline', color: 'inherit' }}>
            <Typography variant="inherit">{params.value}</Typography>
          </Link>
        ),
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
        width: 250,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="inherit">
            {params.value}, {params.row.responsiblePartyRelationship}
          </Typography>
        ),
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
        width: 350,
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
        width: 350,
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
        field: 'patientId',
        headerName: 'Patient Id',
        width: 350,
        sortable: true,
      },
      {
        field: 'candidEncounterId',
        headerName: 'Candid Encounter Id',
        width: 350,
        sortable: true,
      },
      {
        field: 'error',
        headerName: 'Error message',
        width: 800,
        sortable: true,
      },
    ],
    []
  );

  const patientsRows = useMemo(() => {
    if (!reportData?.patientsReports) return [];

    return reportData.patientsReports.map((patient) => ({
      id: patient.claimId,
      patientId: patient.id,
      patientName: patient.name,
      patientDob: patient.dob,
      finalizationDate: patient.finalizationDate,
      appointmentDate: patient.appointmentDate,
      responsiblePartyName: patient.responsiblePartyName,
      responsiblePartyRelationship: patient.responsiblePartyRelationshipToPatient,
      amountInvoiceable: patient.amountInvoiceable,
      candidClaimId: patient.claimId,
    }));
  }, [reportData]);

  const failedReportsRows = useMemo(() => {
    if (!reportData?.failedReports) return [];

    return reportData.failedReports.map((patient) => ({
      id: patient.claimId,
      claimId: patient.claimId,
      patientId: patient.patientId,
      candidEncounterId: patient.candidEncounterId,
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
              Invoiceable Patients Report
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
            {reportData && failedReportsRows.length > 0 && (
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
