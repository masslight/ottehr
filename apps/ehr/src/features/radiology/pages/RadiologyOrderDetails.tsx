import { LoadingButton } from '@mui/lab';
import { Button, Checkbox, Chip, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { Box, Stack, useTheme } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DetailTaskCard } from 'src/features/tasks/components/DetailTaskCard';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useChartData, useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { PageTitleStyled } from '../../visits/shared/components/PageTitle';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import { RadiologyDiagnosis, RadiologyDiagnosisField } from '../components/RadiologyDiagnosisField';
import { RadiologyOrderHistoryCard } from '../components/RadiologyOrderHistoryCard';
import { RadiologyOrderLoading } from '../components/RadiologyOrderLoading';
import { RadiologyTableStatusChip } from '../components/RadiologyTableStatusChip';
import { RadiologyViewImageBtn } from '../components/RadiologyViewImageBtn';
import { usePatientRadiologyOrders } from '../components/usePatientRadiologyOrders';
import { useRadiologyConsentExists } from '../components/useRadiologyConsentExists';

interface RadiologyOrderDetailsPageProps {
  // set by the Review & Sign inline edit flow, which has no URL params of its own and
  // collapses back to its order list instead of navigating away
  serviceRequestId?: string;
  onBack?: () => void;
}

export const RadiologyOrderDetailsPage: React.FC<RadiologyOrderDetailsPageProps> = ({
  serviceRequestId: serviceRequestIdProp,
  onBack,
}) => {
  const urlParams = useParams();
  const serviceRequestId = serviceRequestIdProp ?? (urlParams.serviceRequestID as string);
  const navigate = useNavigate();
  const theme = useTheme();

  const [preliminaryReport, setPreliminaryReport] = useState<string | undefined>();
  const [preliminaryReportDx, setPreliminaryReportDx] = useState<RadiologyDiagnosis[]>([]);
  const [missingPreliminaryReportDx, setMissingPreliminaryReportDx] = useState(false);
  const [performedById, setPerformedById] = useState('');
  const [missingPerformedBy, setMissingPerformedBy] = useState(false);
  const [finalReportByUser, setFinalReportByUser] = useState(false);
  const [finalReport, setFinalReport] = useState<string | undefined>();
  const [missingFinalReport, setMissingFinalReport] = useState(false);

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate: saveChartData } = useSaveChartData();
  const { chartData, setPartialChartData } = useChartData();
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

  const handleBack = onBack ?? ((): void => navigate(-1));

  const consentExists = useRadiologyConsentExists();

  const order = orders.find((order) => order.serviceRequestId === serviceRequestId);

  // Seed the preliminary-read diagnosis picker with any diagnosis already on the order (diagnosis is
  // optional at order time, so this may be empty). Runs once when the order first loads.
  useEffect(() => {
    if (order?.status === 'performed' && !order.preliminaryReport && order.diagnoses) {
      setPreliminaryReportDx(order.diagnoses.map((d) => ({ code: d.code, display: d.display })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.serviceRequestId]);

  // The diagnosis captured with the preliminary read is also written to the encounter's chart /
  // Assessment (the billing/claims diagnosis list), mirroring what the order form does at order time.
  // The save-preliminary-report zambda separately stores it on the order's reasonCode; without this
  // step a diagnosis entered only at read time would never reach the Assessment.
  const addReportDxToEncounter = async (dxList: RadiologyDiagnosis[]): Promise<void> => {
    const existingDiagnoses = chartData?.diagnosis;
    const newDx: DiagnosisDTO[] = dxList
      .filter((dx) => !existingDiagnoses?.some((d) => d.code === dx.code))
      .map((dx) => ({ code: dx.code, display: dx.display, isPrimary: false }));
    if (newDx.length === 0) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      saveChartData(
        { diagnosis: newDx },
        {
          onSuccess: (data) => {
            const returnedDiagnosis = data.chartData.diagnosis || [];
            setPartialChartData({ diagnosis: [...returnedDiagnosis, ...(existingDiagnoses || [])] });
            resolve();
          },
          onError: (err) => reject(err),
        }
      );
    });
  };

  const handleSavePreliminaryReport = async (performedById: string): Promise<void> => {
    // Write the diagnosis to the encounter first; a failure here must block the read so the two never
    // diverge. The dedupe above makes a re-save safe after a partial failure.
    try {
      await addReportDxToEncounter(preliminaryReportDx);
    } catch {
      enqueueSnackbar('Failed to save the diagnosis to the encounter. Please try again.', { variant: 'error' });
      return;
    }
    await handleSaveReport(
      serviceRequestId,
      preliminaryReport || '',
      'preliminary',
      preliminaryReportDx.map((d) => d.code),
      performedById
    );
  };
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

  const selectedPerformedBy = performedByOptions.find((option) => option.id === performedById);

  // So a selection can't leak onto the next order viewed.
  useEffect(() => {
    setPerformedById('');
    setMissingPerformedBy(false);
  }, [serviceRequestId]);

  // Gated on `order`: `currentUser` is served from an already-populated store while the orders are still
  // fetching, so an unguarded default would latch onto them and the order's recorded performer never win.
  useEffect(() => {
    if (!order || performedById) return;
    const defaultId = order.performedBy?.id ?? currentUser?.profileResource?.id;
    if (defaultId) {
      setPerformedById(defaultId);
    }
  }, [currentUser?.profileResource?.id, order, performedById]);

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
                    onChange={(e) => {
                      setMissingPerformedBy(false);
                      setPerformedById(e.target.value);
                    }}
                    error={missingPerformedBy}
                    helperText={missingPerformedBy ? 'Performed by is required' : ''}
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
                <>
                  <Box sx={{ mt: 2 }}>
                    <RadiologyDiagnosisField
                      value={preliminaryReportDx}
                      onChange={(dx) => {
                        setMissingPreliminaryReportDx(false);
                        setPreliminaryReportDx(dx);
                      }}
                      quickPickOptions={chartData?.diagnosis}
                      disabled={isReadOnly}
                      error={missingPreliminaryReportDx}
                      helperText={missingPreliminaryReportDx ? 'Please enter a diagnosis to continue' : undefined}
                    />
                  </Box>
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
                </>
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
              saveReportButton('Save Preliminary Report', isSavingReport, () => {
                if (preliminaryReportDx.length === 0) {
                  setMissingPreliminaryReportDx(true);
                  return;
                }
                // This is the only screen that records the performer, so it's captured here or never.
                if (!selectedPerformedBy) {
                  setMissingPerformedBy(true);
                  return;
                }
                void handleSavePreliminaryReport(selectedPerformedBy.id);
              })}

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
