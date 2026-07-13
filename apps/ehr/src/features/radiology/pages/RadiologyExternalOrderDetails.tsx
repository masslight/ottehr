import EditIcon from '@mui/icons-material/Edit';
import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
import PrintIcon from '@mui/icons-material/Print';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  OutlinedInput,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import { phone } from 'phone';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { useGetVitals } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { InputMask } from 'ui-components';
import { isPhoneNumberValid, LATERALITY_SELECTORS, VitalFieldNames } from 'utils';
import { getRadiologyOrderPdf, sendRadiologyOrderFax } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { getRadiologyExternalOrderEditUrl } from '../../visits/in-person/routing/helpers';
import { PageTitleStyled } from '../../visits/shared/components/PageTitle';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import { RadiologyOrderHistoryCard } from '../components/RadiologyOrderHistoryCard';
import { RadiologyOrderLoading } from '../components/RadiologyOrderLoading';
import { RadiologyTableStatusChip } from '../components/RadiologyTableStatusChip';
import { usePatientRadiologyOrders } from '../components/usePatientRadiologyOrders';
import { SAFETY_FLAG_LABELS } from '../constants';

const DetailRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Typography variant="body2" sx={{ mb: 0.5 }}>
    <b>{label}:</b> {value ?? '—'}
  </Typography>
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

  const { orders, loading } = usePatientRadiologyOrders({ serviceRequestId });
  const [printing, setPrinting] = useState(false);
  const [faxNumber, setFaxNumber] = useState('');
  const [faxError, setFaxError] = useState(false);

  const order = orders.find((o) => o.serviceRequestId === serviceRequestId);

  // Prefill the fax number from the performing organization's fax (digits only) once the order loads.
  const performingOrgFax = order?.performingOrganization?.fax;
  useEffect(() => {
    if (performingOrgFax) {
      setFaxNumber(performingOrgFax.replace(/\D/g, '').slice(-10));
    }
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

  const handleSendFax = async (): Promise<void> => {
    if (!oystehrZambda) return;
    if (faxError || !faxNumber) {
      enqueueSnackbar('Please enter a valid fax number.', { variant: 'error' });
      return;
    }
    try {
      await sendRadiologyOrderFax(oystehrZambda, { serviceRequestId, faxNumber });
      enqueueSnackbar('Fax sent.', { variant: 'success' });
    } catch (e) {
      console.error('Failed to send radiology order fax', e);
      enqueueSnackbar('Error sending fax.', { variant: 'error' });
    }
  };

  if (loading || !order) {
    return <RadiologyOrderLoading />;
  }

  const org = order.performingOrganization;
  const safetyFlagLabels = (order.safetyFlags ?? []).map((flag) => SAFETY_FLAG_LABELS[flag]).join(', ');

  const editUrl = getRadiologyExternalOrderEditUrl(appointmentId, serviceRequestId);

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
              <Typography variant="h6" sx={{ color: theme.palette.primary.dark }}>
                Order Details
              </Typography>
              {!isReadOnly && (
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
            {safetyFlagLabels && <DetailRow label="Patient has" value={safetyFlagLabels} />}
            <DetailRow label="Weight" value={weight != null ? `${weight} kg` : undefined} />

            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ color: theme.palette.primary.dark, mb: 1 }}>
                Performing Organization
              </Typography>
              <DetailRow label="Organization Name" value={org?.name} />
              <DetailRow label="Address" value={org?.address} />
              <DetailRow label="Phone" value={org?.phone} />
              <DetailRow label="Fax" value={org?.fax} />
            </Box>
          </Box>

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff', p: 2 }}>
            <Typography variant="h6" sx={{ color: theme.palette.primary.dark, mb: 1 }}>
              Print & Fax
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <LoadingButton
                variant="outlined"
                color="primary"
                startIcon={<PrintIcon />}
                loading={printing}
                onClick={handlePrint}
                sx={{ borderRadius: 28, textTransform: 'none' }}
              >
                Print Order
              </LoadingButton>
              <ConfirmationDialog
                title="Send Fax"
                description={
                  <FormControl variant="outlined" fullWidth error={faxError} sx={{ mt: 2, mb: -2 }}>
                    <InputLabel shrink required htmlFor="radiology-fax-number">
                      Fax number
                    </InputLabel>
                    <OutlinedInput
                      id="radiology-fax-number"
                      label="Fax number"
                      notched
                      required
                      type="tel"
                      placeholder="(XXX) XXX-XXXX"
                      value={faxNumber}
                      inputMode="numeric"
                      inputComponent={InputMask as any}
                      inputProps={{ mask: '(000) 000-0000' }}
                      onChange={(e) => {
                        const number = e.target.value.replace(/\D/g, '');
                        setFaxNumber(number);
                        setFaxError(!(isPhoneNumberValid(number) && phone(number).isValid));
                      }}
                    />
                    <FormHelperText error sx={{ visibility: faxError ? 'visible' : 'hidden' }}>
                      Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number
                    </FormHelperText>
                  </FormControl>
                }
                response={handleSendFax}
                actionButtons={{
                  proceed: { text: 'Send', disabled: faxNumber === '' || faxError },
                  back: { text: 'Cancel' },
                  reverse: true,
                }}
              >
                {(showDialog) => (
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<FaxOutlinedIcon />}
                    onClick={showDialog}
                    sx={{ borderRadius: 28, textTransform: 'none' }}
                  >
                    Send Fax
                  </Button>
                )}
              </ConfirmationDialog>
            </Box>
          </Box>

          <RadiologyOrderHistoryCard orderHistory={order.history} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              sx={{ borderRadius: 28, padding: '8px 22px', textTransform: 'none' }}
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            {!isReadOnly && (
              <Tooltip title="Edit order">
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<EditIcon />}
                  sx={{ borderRadius: 28, padding: '8px 22px', textTransform: 'none' }}
                  onClick={() => navigate(editUrl)}
                >
                  Edit
                </Button>
              </Tooltip>
            )}
          </Box>
        </Stack>
      </div>
    </WithRadiologyBreadcrumbs>
  );
};
