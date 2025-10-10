import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { Alert, Box, Button, Card, CardContent, CircularProgress, IconButton, Typography } from '@mui/material';
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

  const practitionerColumns: GridColDef[] = useMemo(
    () => [
      {
        field: 'patientName',
        headerName: 'Patient Name',
        flex: 1,
        sortable: true,
      },
      {
        field: 'PatientDob',
        headerName: 'DOB',
        flex: 1,
        sortable: true,
      },
      {
        field: 'serviceDate',
        headerName: 'Service Date',
        flex: 1,
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
        flex: 1,
        sortable: true,
      },
    ],
    []
  );

  const patientsRows = useMemo(() => {
    if (!reportData?.patients) return [];

    return reportData.patients.map((patient) => ({
      id: patient.id,
      patientName: patient.name,
      PatientDob: patient.dob,
      serviceDate: patient.serviceDate,
      responsiblePartyName: patient.responsiblePartyName,
      amountInvoiceable: patient.amountInvoiceable,
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
          Report generation can take up to ?? minutes.
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
            This report was generated on {reportData.date}. {reportData.claimsFound} claims were used to generate this
            report.
          </Typography>
        )}

        {!loading && reportData && (
          <Box>
            {/* Practitioner Table Section */}
            {reportData && patientsRows.length > 0 && (
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Invoiceable Patients
                  </Typography>
                  <Box sx={{ height: 400, width: '100%' }}>
                    <DataGrid
                      rows={patientsRows}
                      columns={practitionerColumns}
                      initialState={{
                        pagination: {
                          paginationModel: { pageSize: 25 },
                        },
                        sorting: {
                          sortModel: [{ field: 'total', sort: 'desc' }],
                        },
                      }}
                      pageSizeOptions={[25, 50, 100]}
                      disableRowSelectionOnClick
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
