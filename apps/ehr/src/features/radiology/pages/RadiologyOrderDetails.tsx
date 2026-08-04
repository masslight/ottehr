import { LoadingButton } from '@mui/lab';
import { Button, Checkbox, Chip, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { Box, Stack, useTheme } from '@mui/system';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DetailTaskCard } from 'src/features/tasks/components/DetailTaskCard';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { RadiologyOrderStatus } from 'utils';
import { PageTitleStyled } from '../../visits/shared/components/PageTitle';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import { RadiologyOrderHistoryCard } from '../components/RadiologyOrderHistoryCard';
import { RadiologyOrderLoading } from '../components/RadiologyOrderLoading';
import { RadiologyTableStatusChip } from '../components/RadiologyTableStatusChip';
import { RadiologyViewImageBtn } from '../components/RadiologyViewImageBtn';
import { usePatientRadiologyOrders } from '../components/usePatientRadiologyOrders';
import { useRadiologyConsentExists } from '../components/useRadiologyConsentExists';

export const RadiologyOrderDetailsPage: React.FC = () => {
  const urlParams = useParams();
  const serviceRequestId = urlParams.serviceRequestID as string;
  const navigate = useNavigate();
  const theme = useTheme();

  const [preliminaryReport, setPreliminaryReport] = useState<string | undefined>();
  const [performedById, setPerformedById] = useState('');
  const [finalReportByUser, setFinalReportByUser] = useState(false);
  const [finalReport, setFinalReport] = useState<string | undefined>();
  const [missingFinalReport, setMissingFinalReport] = useState(false);

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const currentUser = useEvolveUser();

  const {
    orders,
    loading,
    handleSaveReport,
    handleSendForFinalRead,
    handleUpdateConsent,
    isSavingReport,
    isSendingForFinalRead,
    isUpdatingConsent,
    fetchOrders,
  } = usePatientRadiologyOrders({
    serviceRequestId,
  });

  const handleBack = (): void => {
    navigate(-1);
  };

  const consentExists = useRadiologyConsentExists();

  const order = orders.find((order) => order.serviceRequestId === serviceRequestId);

  const canEditPerformedBy = order?.status === RadiologyOrderStatus.performed && !order.preliminaryReport;

  const performedByOptions = useMemo(() => {
    const options: { id: string; name: string }[] = [];
    const addOption = (id: string | undefined, name: string | undefined): void => {
      if (!id || options.some((option) => option.id === id)) return;
      options.push({ id, name: name || id });
    };
    addOption(currentUser?.profileResource?.id, currentUser?.userName);
    addOption(order?.providerId, order?.providerName);
    addOption(order?.performedBy?.id, order?.performedBy?.name);
    return options;
  }, [currentUser, order?.performedBy, order?.providerId, order?.providerName]);

  useEffect(() => {
    if (performedById) return;
    const defaultId = order?.performedBy?.id ?? currentUser?.profileResource?.id;
    if (defaultId) {
      setPerformedById(defaultId);
    }
  }, [currentUser?.profileResource?.id, order?.performedBy?.id, performedById]);

  const saveReportButton = (label: string, loading?: boolean, btnOnClick?: () => void): JSX.Element => {
    const btn = (
      <LoadingButton
        loading={loading}
        variant="contained"
        color="primary"
        sx={{ borderRadius: 28, padding: '8px 22px', textTransform: 'none' }}
        onClick={btnOnClick}
        disabled={isReadOnly}
      >
        {label}
      </LoadingButton>
    );

    if (isReadOnly) {
      return (
        <Tooltip placement="top" title={`Please unlock the progress note to ${label}`}>
          <span>{btn}</span>
        </Tooltip>
      );
    }
    return btn;
  };

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
                mr: 1,
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

          {order.task && (
            <Box>
              <DetailTaskCard task={order.task} fetchOrders={() => fetchOrders({ serviceRequestId })}></DetailTaskCard>
            </Box>
          )}

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
            <Box sx={{ padding: 2 }}>
              <RadiologyViewImageBtn
                serviceRequestId={serviceRequestId}
                disabled={order.status === 'pending'}
                displaySmall={false}
              />

              {order.studyName && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1, textDecoration: 'underline' }}>
                    Study Name
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {order.studyName}
                  </Typography>
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

              {canEditPerformedBy ? (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    data-testid={dataTestIds.radiologyPage.performedBySelect}
                    id="performed-by-field"
                    select
                    label="Performed by"
                    fullWidth
                    size="small"
                    value={performedById}
                    onChange={(e) => setPerformedById(e.target.value)}
                    disabled={isReadOnly}
                  >
                    {!performedById && <MenuItem value="">Select</MenuItem>}
                    {performedByOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              ) : (
                order.performedBy && (
                  <Box sx={{ mt: 2 }} data-testid={dataTestIds.radiologyPage.performedByValue}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1, textDecoration: 'underline' }}>
                      Performed by
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {order.performedBy.name}
                    </Typography>
                  </Box>
                )
              )}

              {order.status === 'performed' && !order.preliminaryReport && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    id="preliminary-report-field"
                    label="Preliminary Report"
                    placeholder="Enter preliminary report for the radiology order"
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={10}
                    size="small"
                    value={preliminaryReport}
                    onChange={(e) => setPreliminaryReport(e.target.value)}
                    disabled={isReadOnly}
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

              <Box sx={{ mt: 1 }}>
                <Box style={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    sx={{ paddingLeft: 0 }}
                    checked={order.consentObtained}
                    disabled={isUpdatingConsent}
                    onChange={() => handleUpdateConsent(serviceRequestId, !order.consentObtained)}
                  />
                  <Typography>
                    I have obtained the{' '}
                    {consentExists ? (
                      <Link
                        target="_blank"
                        to={`/consent_radiology.pdf`}
                        style={{ color: theme.palette.primary.main }}
                        rel="noopener noreferrer"
                      >
                        consent for X-ray
                      </Link>
                    ) : (
                      'consent for X-ray'
                    )}
                  </Typography>
                </Box>
              </Box>

              {order.status === 'preliminary' && (
                <>
                  <Box sx={{ mt: 1 }}>
                    <Box style={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        sx={{ paddingLeft: 0 }}
                        checked={finalReportByUser}
                        onChange={() => {
                          if (finalReportByUser) setFinalReport(undefined);
                          setFinalReportByUser(!finalReportByUser);
                        }}
                      />
                      <Typography>Don't send to teleradiology, I will write the final report myself.</Typography>
                    </Box>
                  </Box>
                  {finalReportByUser && (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        id="final-report-field"
                        label="Final Report"
                        placeholder="Enter final report for the radiology order"
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={10}
                        size="small"
                        value={finalReport}
                        onChange={(e) => {
                          setMissingFinalReport(false);
                          setFinalReport(e.target.value);
                        }}
                        error={missingFinalReport}
                        helperText={missingFinalReport ? 'Final report is required' : ''}
                        disabled={isReadOnly}
                      />
                    </Box>
                  )}
                </>
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

            {order.status === 'performed' &&
              !order.preliminaryReport &&
              saveReportButton('Save Preliminary Report', isSavingReport, () =>
                handleSaveReport(
                  serviceRequestId,
                  preliminaryReport || '',
                  'preliminary',
                  performedByOptions.find((option) => option.id === performedById)
                )
              )}

            {order.status === 'preliminary' &&
              (finalReportByUser
                ? saveReportButton('Save as Final', isSavingReport, () => {
                    if (!finalReport || !(finalReport.length > 0)) {
                      setMissingFinalReport(true);
                      return;
                    }
                    void handleSaveReport(serviceRequestId, finalReport || '', 'final');
                  })
                : saveReportButton('Send for Final Read', isSendingForFinalRead, () =>
                    handleSendForFinalRead(serviceRequestId)
                  ))}
          </Box>
        </Stack>
      </div>
    </WithRadiologyBreadcrumbs>
  );
};
