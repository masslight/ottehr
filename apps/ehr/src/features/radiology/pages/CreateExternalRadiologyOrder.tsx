import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { phone } from 'phone';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { getRadiologyExternalOrderDetailsUrl, getRadiologyUrl } from 'src/features/visits/in-person/routing/helpers';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { InputMask } from 'ui-components';
import {
  DiagnosisDTO,
  GetRadiologyOrderListZambdaOrder,
  isPhoneNumberValid,
  RADIOLOGY_SAFETY_FLAGS,
  RadiologyPerformingOrganization,
  RadiologySafetyFlag,
} from 'utils';
import { createRadiologyOrder, updateRadiologyOrder } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { WithRadiologyBreadcrumbs } from '../components/RadiologyBreadcrumbs';
import {
  RadiologyOrderCoreFields,
  RadiologyOrderFormActions,
  useRadiologyOrderForm,
} from '../components/RadiologyOrderFormShared';
import { RadiologyOrderLoading } from '../components/RadiologyOrderLoading';
import { usePatientRadiologyOrders } from '../components/usePatientRadiologyOrders';
import { SAFETY_FLAG_LABELS } from '../constants';

interface CreateExternalRadiologyOrderProps {
  /** when provided, the form is in edit mode and submits an update instead of a create */
  initialOrder?: GetRadiologyOrderListZambdaOrder;
}

/** True when a non-empty digit string is not a valid 10-digit phone/fax number. Empty is allowed (optional field). */
const phoneDigitsInvalid = (digits: string): boolean =>
  digits.length > 0 && !(isPhoneNumberValid(digits) && phone(digits).isValid);

/** Formats raw digits as (xxx) xxx-xxxx for storage/display; returns undefined when empty. */
const formatPhoneDigits = (digits: string): string | undefined => {
  const d = digits.replace(/\D/g, '');
  if (!d) return undefined;
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
};

export const CreateExternalRadiologyOrder: React.FC<CreateExternalRadiologyOrderProps> = ({ initialOrder }) => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const { id: appointmentIdFromUrl } = useParams();
  const isEditMode = !!initialOrder;
  const [error, setError] = useState<string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { encounter } = useAppointmentData();

  const form = useRadiologyOrderForm(
    initialOrder
      ? {
          orderDx: initialOrder.diagnoses?.map((d) => ({ code: d.code, display: d.display }) as DiagnosisDTO),
          orderCpt: initialOrder.cptCode
            ? { code: initialOrder.cptCode, display: initialOrder.cptCodeDisplay }
            : undefined,
          studyName: initialOrder.studyName,
          clinicalHistory: initialOrder.clinicalHistory,
          laterality: initialOrder.laterality,
        }
      : undefined
  );
  const {
    orderDx,
    orderCpt,
    studyName,
    clinicalHistory,
    lateralityModifier,
    addAdditionalDxToEncounter,
    chartCptCodes,
    setPartialChartData,
  } = form;

  // Priority/STAT is an in-house-only concept; external orders are routine. Preserve any prior value on edit.
  const stat = initialOrder?.isStat ?? false;
  // Consent is not part of the external flow (per design/spec); preserve any prior value on edit.
  const consentObtained = initialOrder?.consentObtained ?? false;

  // External-only fields
  const [orgName, setOrgName] = useState<string>(initialOrder?.performingOrganization?.name ?? '');
  const [orgAddress, setOrgAddress] = useState<string>(initialOrder?.performingOrganization?.address ?? '');
  // Phone/fax are stored as raw digits; formatted for display via InputMask and on submit.
  const [orgPhone, setOrgPhone] = useState<string>(
    (initialOrder?.performingOrganization?.phone ?? '').replace(/\D/g, '')
  );
  const [orgPhoneError, setOrgPhoneError] = useState<boolean>(false);
  const [orgFax, setOrgFax] = useState<string>((initialOrder?.performingOrganization?.fax ?? '').replace(/\D/g, ''));
  const [orgFaxError, setOrgFaxError] = useState<boolean>(false);
  const [timeWindow, setTimeWindow] = useState<string>(initialOrder?.timeWindow ?? '');
  const [safetyFlags, setSafetyFlags] = useState<RadiologySafetyFlag[]>(initialOrder?.safetyFlags ?? []);

  const toggleSafetyFlag = (flag: RadiologySafetyFlag): void => {
    setSafetyFlags((prev) => (prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]));
  };

  const buildPerformingOrganization = (): RadiologyPerformingOrganization | undefined => {
    const org: RadiologyPerformingOrganization = {
      name: orgName.trim() || undefined,
      address: orgAddress.trim() || undefined,
      phone: formatPhoneDigits(orgPhone),
      fax: formatPhoneDigits(orgFax),
    };
    return org.name || org.address || org.phone || org.fax ? org : undefined;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);

    const paramsSatisfied =
      orderDx.length > 0 &&
      orderCpt &&
      encounter.id &&
      clinicalHistory.length <= 255 &&
      !phoneDigitsInvalid(orgPhone) &&
      !phoneDigitsInvalid(orgFax);

    if (oystehrZambda && paramsSatisfied && encounter.id) {
      const sharedFields = {
        diagnosisCodes: orderDx.map((dx) => dx.code),
        cptCode: orderCpt.code,
        lateralityModifier,
        stat,
        clinicalHistory,
        studyName: studyName || undefined,
        consentObtained,
        external: true,
        performingOrganization: buildPerformingOrganization(),
        timeWindow: timeWindow.trim() || undefined,
        safetyFlags: safetyFlags.length > 0 ? safetyFlags : undefined,
      };
      try {
        await addAdditionalDxToEncounter();
        if (isEditMode && initialOrder) {
          await updateRadiologyOrder(oystehrZambda, {
            serviceRequestId: initialOrder.serviceRequestId,
            consentObtained,
            edit: sharedFields,
          });
          navigate(getRadiologyExternalOrderDetailsUrl(appointmentIdFromUrl || '', initialOrder.serviceRequestId));
        } else {
          const res = await createRadiologyOrder(oystehrZambda, { ...sharedFields, encounterId: encounter.id });
          if (res.cptCodesSaved && res.cptCodesSaved.length > 0) {
            setPartialChartData({ cptCodes: [...chartCptCodes, ...res.cptCodesSaved] });
          }
          navigate(getRadiologyUrl(appointmentIdFromUrl || ''));
        }
      } catch (submitError) {
        console.error('error', JSON.stringify(submitError));
        setError(['There was an error completing the order']);
      }
    } else if (!paramsSatisfied) {
      const errorMessage = [];
      if (orderDx.length === 0) errorMessage.push('Please enter a diagnosis to continue');
      if (!orderCpt) errorMessage.push('Please select a study type (CPT code) to continue');
      if (clinicalHistory.length > 255) errorMessage.push('Clinical history must be 255 characters or less');
      if (phoneDigitsInvalid(orgPhone)) errorMessage.push('Please enter a valid 10-digit phone number');
      if (phoneDigitsInvalid(orgFax)) errorMessage.push('Please enter a valid 10-digit fax number');
      if (errorMessage.length === 0) errorMessage.push('There was an error completing the order');
      setError(errorMessage);
    }
    setSubmitting(false);
  };

  return (
    <DetailPageContainer>
      <WithRadiologyBreadcrumbs sectionName={isEditMode ? 'Edit External Radiology Order' : 'External Radiology Order'}>
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
              {isEditMode ? 'Edit External Radiology Order' : 'External Radiology Order'}
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <Paper sx={{ p: 3 }}>
              <Grid container sx={{ width: '100%' }} spacing={1} rowSpacing={2}>
                <RadiologyOrderCoreFields form={form} lateralityLabel="Laterality" />

                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                    Select if the patient has…
                  </Typography>
                  <FormGroup>
                    {RADIOLOGY_SAFETY_FLAGS.map((flag) => (
                      <FormControlLabel
                        key={flag}
                        control={
                          <Checkbox checked={safetyFlags.includes(flag)} onChange={() => toggleSafetyFlag(flag)} />
                        }
                        label={SAFETY_FLAG_LABELS[flag]}
                      />
                    ))}
                  </FormGroup>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    id="time-window"
                    label="Time frame"
                    placeholder="e.g. Please perform within 4 hours"
                    fullWidth
                    size="small"
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ color: theme.palette.primary.dark, mt: 1 }}>
                    Performing Organization
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    id="org-name"
                    label="Organization name"
                    fullWidth
                    size="small"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    id="org-address"
                    label="Address"
                    fullWidth
                    size="small"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    id="org-phone"
                    label="Phone"
                    fullWidth
                    size="small"
                    type="tel"
                    placeholder="(XXX) XXX-XXXX"
                    inputMode="numeric"
                    value={orgPhone}
                    error={orgPhoneError}
                    helperText={
                      orgPhoneError ? 'Phone must be 10 digits in the format (xxx) xxx-xxxx and a valid number' : ' '
                    }
                    InputProps={{ inputComponent: InputMask as any }}
                    inputProps={{ mask: '(000) 000-0000' }}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => {
                      const number = e.target.value.replace(/\D/g, '');
                      setOrgPhone(number);
                      setOrgPhoneError(phoneDigitsInvalid(number));
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    id="org-fax"
                    label="Fax"
                    fullWidth
                    size="small"
                    type="tel"
                    placeholder="(XXX) XXX-XXXX"
                    inputMode="numeric"
                    value={orgFax}
                    error={orgFaxError}
                    helperText={
                      orgFaxError ? 'Fax must be 10 digits in the format (xxx) xxx-xxxx and a valid number' : ' '
                    }
                    InputProps={{ inputComponent: InputMask as any }}
                    inputProps={{ mask: '(000) 000-0000' }}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => {
                      const number = e.target.value.replace(/\D/g, '');
                      setOrgFax(number);
                      setOrgFaxError(phoneDigitsInvalid(number));
                    }}
                  />
                </Grid>

                <RadiologyOrderFormActions
                  appointmentId={appointmentIdFromUrl || ''}
                  submitting={submitting}
                  submitLabel={isEditMode ? 'Save' : 'Order'}
                  errors={error}
                />
              </Grid>
            </Paper>
          </form>
        </Stack>
      </WithRadiologyBreadcrumbs>
    </DetailPageContainer>
  );
};

/**
 * Edit-mode entry point: loads the existing external order by serviceRequestId, then renders the
 * shared form pre-filled. Kept separate so the create route never triggers an order fetch.
 */
export const EditExternalRadiologyOrder: React.FC = () => {
  const { serviceRequestID } = useParams();
  const navigate = useNavigate();
  const { orders, loading } = usePatientRadiologyOrders({ serviceRequestId: serviceRequestID });
  const order = orders.find((o) => o.serviceRequestId === serviceRequestID);

  if (loading) {
    return <RadiologyOrderLoading />;
  }

  // Only external (print-only) orders may be edited; in-house orders are synced to AdvaPACS and
  // must not be rewritten through this form (the backend rejects it too).
  if (!order || !order.external) {
    return (
      <Stack spacing={2} sx={{ p: 3, alignItems: 'flex-start' }}>
        <Typography variant="h6">
          {!order ? 'Radiology order not found.' : 'This order is not an external order and cannot be edited here.'}
        </Typography>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Stack>
    );
  }

  return <CreateExternalRadiologyOrder initialOrder={order} />;
};
