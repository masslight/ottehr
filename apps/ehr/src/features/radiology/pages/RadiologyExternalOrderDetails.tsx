import { otherColors } from '@ehrTheme/colors';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Chip, IconButton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { RoundedButton } from 'src/components/RoundedButton';
import { SendFaxButton } from 'src/features/visits/shared/components/review-tab/SendFaxButton';
import { useGetVitals } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { LATERALITY_SELECTORS, RadiologyResultDTO, VitalFieldNames } from 'utils';
import {
  createZ3Object,
  deleteRadiologyResult,
  getRadiologyOrderPdf,
  listRadiologyResults,
  sendRadiologyOrderFax,
  uploadRadiologyResult,
} from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { getRadiologyExternalOrderEditUrl } from '../../visits/in-person/routing/helpers';
import { PageTitleStyled } from '../../visits/shared/components/PageTitle';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import { RadiologyOrderHistoryCard } from '../components/RadiologyOrderHistoryCard';
import { RadiologyOrderLoading } from '../components/RadiologyOrderLoading';
import { RadiologyTableStatusChip } from '../components/RadiologyTableStatusChip';
import { usePatientRadiologyOrders } from '../components/usePatientRadiologyOrders';
import { SAFETY_FLAG_LABELS } from '../constants';

const DetailRow: React.FC<{ label: string; value?: React.ReactNode; icon?: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
    {icon}
    <Typography variant="body2" sx={{ fontWeight: 500 }}>
      {label}:
    </Typography>
    <Typography variant="body2">{value ?? '—'}</Typography>
  </Box>
);

export const RadiologyExternalOrderDetailsPage: React.FC = () => {
  const urlParams = useParams();
  const serviceRequestId = urlParams.serviceRequestID as string;
  const appointmentId = urlParams.id as string;
  const navigate = useNavigate();
  const theme = useTheme();

  const { oystehrZambda } = useApiClients();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { encounter } = useAppointmentData();
  const { data: encounterVitals } = useGetVitals(encounter?.id);
  const weight = encounterVitals?.[VitalFieldNames.VitalWeight]?.[0]?.value;

  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const {
    orders,
    loading,
    error: ordersError,
  } = usePatientRadiologyOrders({ serviceRequestId, refreshKey: ordersRefreshKey });
  const [printing, setPrinting] = useState(false);
  const [results, setResults] = useState<RadiologyResultDTO[]>([]);
  const [uploading, setUploading] = useState(false);
  const resultInputRef = useRef<HTMLInputElement>(null);

  const order = orders.find((o) => o.serviceRequestId === serviceRequestId);

  const fetchResults = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const response = await listRadiologyResults(oystehrZambda, { serviceRequestId });
      setResults(response.results);
    } catch (e) {
      console.error('Failed to load radiology results', e);
    }
  }, [oystehrZambda, serviceRequestId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const handleDeleteResult = async (documentReferenceId: string): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      await deleteRadiologyResult(oystehrZambda, { documentReferenceId });
      enqueueSnackbar('Result deleted.', { variant: 'success' });
      await fetchResults();
      // The order's derived status/history depend on attached results — refetch it too.
      setOrdersRefreshKey((key) => key + 1);
    } catch (e) {
      console.error('Failed to delete radiology result', e);
      enqueueSnackbar('Failed to delete result.', { variant: 'error' });
    }
  };

  const handleUploadResult = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = ''; // reset so the same file can be re-picked
    if (!file || !oystehrZambda) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const fileFormat =
      extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'pdf' ? extension : undefined;
    if (!fileFormat) {
      enqueueSnackbar('Only PDF, PNG, JPG, and JPEG files are supported.', { variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      const z3URL = await createZ3Object(
        { appointmentID: appointmentId, fileType: 'patient-photo-radiology-result', fileFormat, file },
        oystehrZambda
      );
      await uploadRadiologyResult(oystehrZambda, { serviceRequestId, z3URL, title: file.name });
      enqueueSnackbar('Result uploaded.', { variant: 'success' });
      await fetchResults();
      // The order's derived status/history depend on attached results — refetch it too.
      setOrdersRefreshKey((key) => key + 1);
    } catch (e) {
      console.error('Failed to upload radiology result', e);
      enqueueSnackbar('Failed to upload result.', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  // Prefill the fax number from the performing organization's fax, but only when it unambiguously
  // normalizes to a 10-digit NANP number. The stored value is free text and may carry an extension
  // ("... ext. 22"); guessing at those digits risks faxing PHI to a wrong-but-valid number, so in
  // that case leave the field empty for the user to fill in.
  const performingOrgFax = order?.performingOrganization?.fax;
  const initialFaxNumber = useMemo(() => {
    if (!performingOrgFax) return undefined;
    const digits = performingOrgFax.replace(/\D/g, '');
    const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    return normalized.length === 10 ? normalized : undefined;
  }, [performingOrgFax]);

  const handlePrint = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setPrinting(true);
    try {
      const { presignedURL } = await getRadiologyOrderPdf(oystehrZambda, { serviceRequestId });
      window.open(presignedURL, '_blank');
    } catch (e) {
      console.error('Failed to generate radiology order PDF', e);
      enqueueSnackbar('Failed to generate the order PDF', { variant: 'error' });
    } finally {
      setPrinting(false);
    }
  };

  const handleSendFax = async (faxNumber: string): Promise<void> => {
    if (!oystehrZambda) throw new Error('API client not available');
    await sendRadiologyOrderFax(oystehrZambda, { serviceRequestId, faxNumber });
  };

  if (loading) {
    return <RadiologyOrderLoading />;
  }

  if (!order) {
    return (
      <Stack spacing={2} sx={{ p: 3, alignItems: 'flex-start' }}>
        <Typography variant="h6">
          {ordersError ? 'Failed to load the radiology order.' : 'Radiology order not found.'}
        </Typography>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Stack>
    );
  }

  const org = order.performingOrganization;
  const safetyFlagLabels = (order.safetyFlags ?? []).map((flag) => SAFETY_FLAG_LABELS[flag]).join(', ');

  const editUrl = getRadiologyExternalOrderEditUrl(appointmentId, serviceRequestId);
  // The order is editable only until results are uploaded (spec).
  const canEdit = !isReadOnly && results.length === 0;

  return (
    <WithRadiologyBreadcrumbs sectionName={order.studyType}>
      <div style={{ maxWidth: '714px', margin: '0 auto' }}>
        <Stack spacing={2} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label="EXTERNAL"
              sx={{
                borderRadius: '4px',
                fontWeight: 900,
                fontSize: '12px',
                background: theme.palette.info.main,
                color: 'white',
              }}
            />
            {order.timeWindow && (
              <Typography variant="body2" sx={{ color: theme.palette.error.main, fontWeight: 'bold' }}>
                {order.timeWindow}
              </Typography>
            )}
          </Box>

          <PageTitleStyled>{`Radiology: ${order.studyType}`}</PageTitleStyled>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
              {order.diagnosis}
            </Typography>
            <RadiologyTableStatusChip status={order.status} />
          </Box>

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
                Results
              </Typography>
              {!isReadOnly && (
                <>
                  <input
                    ref={resultInputRef}
                    type="file"
                    hidden
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={handleUploadResult}
                  />
                  <LoadingButton
                    variant="outlined"
                    size="small"
                    loading={uploading}
                    startIcon={<UploadFileOutlinedIcon />}
                    onClick={() => resultInputRef.current?.click()}
                    sx={{ borderRadius: 28, textTransform: 'none' }}
                  >
                    Upload Result
                  </LoadingButton>
                </>
              )}
            </Box>
            {results.length > 0 ? (
              <Stack spacing={1}>
                {results.map((result) => (
                  <Box
                    key={result.documentReferenceId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f7f7f7',
                      borderRadius: 1,
                      px: 2,
                      py: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                      <InsertDriveFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography
                        variant="body2"
                        onClick={() => window.open(result.url, '_blank')}
                        sx={{ fontWeight: 'bold', cursor: 'pointer', wordBreak: 'break-all' }}
                      >
                        {result.title}
                      </Typography>
                    </Box>
                    {!isReadOnly && (
                      <ConfirmationDialog
                        title="Delete result"
                        description={`Delete "${result.title}"? This cannot be undone.`}
                        response={() => handleDeleteResult(result.documentReferenceId)}
                        actionButtons={{ proceed: { text: 'Delete' }, back: { text: 'Cancel' }, reverse: true }}
                      >
                        {(showDialog) => (
                          <IconButton aria-label="delete result" onClick={showDialog}>
                            <DeleteOutlinedIcon sx={{ color: theme.palette.error.main }} />
                          </IconButton>
                        )}
                      </ConfirmationDialog>
                    )}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No results uploaded yet.
              </Typography>
            )}
          </Box>

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h5" sx={{ color: theme.palette.primary.dark }}>
                Order Details
              </Typography>
              {canEdit && (
                <IconButton aria-label="edit external radiology order" onClick={() => navigate(editUrl)}>
                  <EditIcon color="primary" />
                </IconButton>
              )}
            </Box>

            {order.studyName && <DetailRow label="Study Name" value={order.studyName} />}
            {order.laterality && (
              <DetailRow
                label="Laterality"
                value={`${order.laterality} (${LATERALITY_SELECTORS[order.laterality].uiDisplay})`}
              />
            )}
            {order.clinicalHistory && <DetailRow label="Clinical History" value={order.clinicalHistory} />}
            {safetyFlagLabels && (
              <DetailRow
                label="Patient has"
                value={safetyFlagLabels}
                icon={<WarningAmberOutlinedIcon fontSize="small" sx={{ color: otherColors.priorityHighText }} />}
              />
            )}
            <DetailRow label="Weight" value={weight != null ? `${weight} kg` : undefined} />

            <Box sx={{ mt: 2 }}>
              <Typography variant="h5" sx={{ color: theme.palette.primary.dark, mb: 1 }}>
                Performing Organization
              </Typography>
              <DetailRow label="Organization Name" value={org?.name} />
              <DetailRow label="Address" value={org?.address} />
              <DetailRow label="Phone" value={org?.phone} />
              <DetailRow label="Fax" value={org?.fax} />
            </Box>
          </Box>

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff', p: 2 }}>
            <Typography variant="h5" sx={{ color: theme.palette.primary.dark, mb: 1 }}>
              Print & Fax
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <RoundedButton
                variant="outlined"
                color="primary"
                startIcon={<PrintOutlinedIcon />}
                loading={printing}
                onClick={handlePrint}
              >
                Print Order
              </RoundedButton>
              <SendFaxButton onSend={handleSendFax} initialFaxNumber={initialFaxNumber} />
            </Box>
          </Box>

          <RadiologyOrderHistoryCard orderHistory={order.history} label="Order History" />
        </Stack>
      </div>
    </WithRadiologyBreadcrumbs>
  );
};
