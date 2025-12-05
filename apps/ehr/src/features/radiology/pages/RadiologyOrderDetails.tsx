import { LoadingButton } from '@mui/lab';
import { Button, Chip, CircularProgress, TextField, Typography } from '@mui/material';
import { Box, Stack, useTheme } from '@mui/system';
import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { radiologyLaunchViewer } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import radiologyIcon from 'src/themes/ottehr/icons/mui-radiology.svg';
import { PageTitleStyled } from '../../visits/shared/components/PageTitle';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import { RadiologyOrderHistoryCard } from '../components/RadiologyOrderHistoryCard';
import { RadiologyOrderLoading } from '../components/RadiologyOrderLoading';
import { RadiologyTableStatusChip } from '../components/RadiologyTableStatusChip';
import { usePatientRadiologyOrders } from '../components/usePatientRadiologyOrders';

export const RadiologyOrderDetailsPage: React.FC = () => {
  const { oystehrZambda } = useApiClients();
  const urlParams = useParams();
  const serviceRequestId = urlParams.serviceRequestID as string;
  const navigate = useNavigate();
  const theme = useTheme();

  const [isLaunchingViewer, setIsLaunchingViewer] = useState(false);
  const [launchViewerError, setLaunchViewerError] = useState<string | null>(null);
  const [preliminaryReport, setPreliminaryReport] = useState<string | undefined>();

  const {
    orders,
    loading,
    handleSavePreliminaryReport,
    handleSendForFinalRead,
    isSavingPreliminaryReport,
    isSendingForFinalRead,
  } = usePatientRadiologyOrders({
    serviceRequestId,
  });

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleViewImageClick = useCallback(async (): Promise<void> => {
    setIsLaunchingViewer(true);
    setLaunchViewerError(null);

    if (!oystehrZambda) {
      console.error('oystehrZambda is not defined');
      return;
    }

    try {
      const response = await radiologyLaunchViewer(oystehrZambda, {
        serviceRequestId: serviceRequestId,
      });

      if (response) {
        window.open(response.url, '_blank');
      } else {
        setLaunchViewerError('Could not launch viewer');
      }
    } catch (err) {
      console.error('Error launching viewer:', err);
      setLaunchViewerError('An error occurred launching the viewer');
    } finally {
      setIsLaunchingViewer(false);
    }
  }, [serviceRequestId, oystehrZambda]);

  const order = orders.find((order) => order.serviceRequestId === serviceRequestId);

  if (loading || !order) {
    return <RadiologyOrderLoading />;
  }

  return (
    <WithRadiologyBreadcrumbs sectionName={order.studyType}>
      <div style={{ maxWidth: '714px', margin: '0 auto' }}>
        <Stack spacing={2} sx={{ p: 3 }}>
          {order.isStat ? (
            <Chip
              size="small"
              label="STAT"
              sx={{
                borderRadius: '4px',
                border: 'none',
                fontWeight: 900,
                fontSize: '14px',
                textTransform: 'uppercase',
                background: theme.palette.error.main,
                color: 'white',
                padding: '8px',
                height: '24px',
                width: 'fit-content',
              }}
              variant="outlined"
            />
          ) : null}
          <PageTitleStyled>{`Radiology: ${order.studyType}`}</PageTitleStyled>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexDirection: 'row',
                fontWeight: 'bold',
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {order.diagnosis}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'row' }}>
              <RadiologyTableStatusChip status={order.status} />
            </Box>
          </Box>

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
            <Box sx={{ padding: 2 }}>
              <Button
                variant="outlined"
                startIcon={
                  <Box
                    sx={{
                      fill: 'gray',
                    }}
                    component="img"
                    src={radiologyIcon}
                    style={{ width: '30px', marginRight: '8px' }}
                  />
                }
                endIcon={isLaunchingViewer ? <CircularProgress size={16} color="inherit" /> : null}
                onClick={() => handleViewImageClick()}
                sx={{ borderRadius: '50px', textTransform: 'none' }}
                disabled={order.status === 'pending' || isLaunchingViewer}
              >
                {isLaunchingViewer ? 'Launching Image...' : 'View Image'}
              </Button>

              {launchViewerError && (
                <Box sx={{ mt: 2, color: 'error.main' }}>
                  <Typography color="error">{launchViewerError}</Typography>
                </Box>
              )}

              {order.clinicalHistory && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1, textDecoration: 'underline' }}>
                    Clinical History
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {order.clinicalHistory}
                  </Typography>
                </Box>
              )}

              {order.status === 'performed' && !order.preliminaryReport && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    id="preliminary-report-field"
                    label="Preliminary Report"
                    placeholder="Enter preliminary report for the radiology order"
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    value={preliminaryReport}
                    onChange={(e) => setPreliminaryReport(e.target.value)}
                  />
                </Box>
              )}

              {order.preliminaryReport != null ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1, textDecoration: 'underline' }}>
                    Preliminary Report
                  </Typography>
                  <Typography variant="body2">
                    <div dangerouslySetInnerHTML={{ __html: atob(order.preliminaryReport) }} />
                  </Typography>
                </Box>
              ) : (
                <div />
              )}

              {order.finalReport != null ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1, textDecoration: 'underline' }}>
                    Final Report
                  </Typography>
                  <Typography variant="body2">
                    <div dangerouslySetInnerHTML={{ __html: atob(order.finalReport) }} />
                  </Typography>
                </Box>
              ) : (
                <div />
              )}
            </Box>
          </Box>

          <RadiologyOrderHistoryCard orderHistory={order.history} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              sx={{
                borderRadius: 28,
                padding: '8px 22px',
                textTransform: 'none',
              }}
              onClick={handleBack}
            >
              Back
            </Button>

            {order.status === 'performed' && !order.preliminaryReport && (
              <LoadingButton
                loading={isSavingPreliminaryReport}
                variant="contained"
                color="primary"
                sx={{
                  borderRadius: 28,
                  padding: '8px 22px',
                  textTransform: 'none',
                }}
                onClick={() => handleSavePreliminaryReport(serviceRequestId, preliminaryReport || '')}
              >
                Save Preliminary Report
              </LoadingButton>
            )}

            {order.status === 'preliminary' && (
              <LoadingButton
                loading={isSendingForFinalRead}
                variant="contained"
                color="primary"
                sx={{
                  borderRadius: 28,
                  padding: '8px 22px',
                  textTransform: 'none',
                }}
                onClick={() => handleSendForFinalRead(serviceRequestId)}
              >
                Send for Final Read
              </LoadingButton>
            )}
          </Box>
        </Stack>
      </div>
    </WithRadiologyBreadcrumbs>
  );
};
