import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField as MuiTextField,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { createImmunizationQuickPick, getImmunizationQuickPicks, updateImmunizationQuickPick } from 'src/api/api';
import { CustomDialog } from 'src/components/dialogs';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { CptCodesInput } from 'src/components/input/CptCodesInput';
import { DateInput } from 'src/components/input/DateInput';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { TimeInput } from 'src/components/input/TimeInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import {
  useAdministerImmunizationOrder,
  useCancelImmunizationOrder,
} from 'src/features/visits/in-person/hooks/useImmunization';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPicksButton } from 'src/features/visits/shared/components/QuickPicksButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useMergedImmunizationQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { ROUTE_OPTIONS } from 'src/shared/utils/options';
import {
  EMERGENCY_CONTACT_RELATIONSHIPS,
  ImmunizationOrder,
  ImmunizationQuickPickData,
  REQUIRED_FIELD_ERROR_MESSAGE,
  RoleType,
  UNIT_OPTIONS,
} from 'utils';
import { ADMINISTERED, AdministrationType, NOT_ADMINISTERED, PARTLY_ADMINISTERED } from '../common';
import { AdministrationConfirmationDialog } from './AdministrationConfirmationDialog';
import { OrderDetailsSection } from './OrderDetailsSection';
import { OrderStatusChip } from './OrderStatusChip';

interface Props {
  order: ImmunizationOrder;
}

const RELATIONSHIP_OPTIONS = Object.entries(EMERGENCY_CONTACT_RELATIONSHIPS).map(([_, value]) => ({
  value: value.code,
  label: value.display,
}));

export const VaccineDetailsCard: React.FC<Props> = ({ order }) => {
  const methods = useForm();
  useEffect(() => {
    methods.reset({
      ...order,
      administrationDetails: {
        ...order.administrationDetails,
        administeredDateTime: DateTime.now().toISO(),
      },
      visGiven: order.administrationDetails?.visGivenDate != null,
      otherReason: '',
    });
  }, [methods, order]);

  const theme = useTheme();
  const navigate = useNavigate();
  const [showAdministrationConfirmationDialog, setShowAdministrationConfirmationDialog] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const administrationTypeRef = useRef<AdministrationType>(ADMINISTERED);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { id: appointmentId } = useParams();
  const { mappedData } = useAppointmentData(appointmentId);

  const { mutateAsync: administerOrder } = useAdministerImmunizationOrder();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder();
  const { quickPicks: mergedQuickPicks, refetch: refetchQuickPicks } = useMergedImmunizationQuickPicks();
  const { oystehrZambda } = useApiClients();
  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator]) ?? false;
  const [quickPickDialogOpen, setQuickPickDialogOpen] = useState(false);
  const [quickPickName, setQuickPickName] = useState('');
  const [existingQuickPicks, setExistingQuickPicks] = useState<ImmunizationQuickPickData[]>([]);
  const [quickPickSaving, setQuickPickSaving] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<ImmunizationQuickPickData | null>(null);

  const onQuickPickSelect = (quickPick: ImmunizationQuickPickData): void => {
    const currentValues = methods.getValues();
    methods.reset({
      ...currentValues,
      administrationDetails: {
        ...currentValues.administrationDetails,
        lot: quickPick.lot,
        expDate: quickPick.expDate,
        mvx: quickPick.mvx,
        cvx: quickPick.cvx,
        cptCodes: quickPick.cptCodes ?? [],
        ndc: quickPick.ndc,
      },
    });
  };

  const openQuickPickDialog = async (): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const response = await getImmunizationQuickPicks(oystehrZambda);
      setExistingQuickPicks(response.quickPicks);
    } catch (error) {
      console.error('Failed to load existing quick picks:', error);
      setExistingQuickPicks(mergedQuickPicks);
    }
    // Suggest name: Vaccine Name | Dose | Units | Route | Injection Site | lot: number | exp: date
    const values = methods.getValues();
    const parts: string[] = [];
    if (values.details?.medication?.name) parts.push(values.details.medication.name);
    if (values.details?.dose) parts.push(values.details.dose);
    if (values.details?.units) parts.push(values.details.units);
    if (values.details?.route) {
      const routeName = ROUTE_OPTIONS.find((opt) => opt.code === values.details.route)?.name;
      parts.push(routeName ?? values.details.route);
    }
    if (values.details?.location?.name) parts.push(values.details.location.name);
    if (values.administrationDetails?.lot) parts.push(`lot: ${values.administrationDetails.lot}`);
    if (values.administrationDetails?.expDate) parts.push(`exp: ${values.administrationDetails.expDate}`);
    setQuickPickName(parts.join(' | '));
    setOverwriteTarget(null);
    setQuickPickDialogOpen(true);
  };

  const buildQuickPickFromCurrentState = (): Omit<ImmunizationQuickPickData, 'id'> => {
    const values = methods.getValues();
    return {
      name: quickPickName.trim(),
      vaccine: values.details?.medication,
      dose: values.details?.dose,
      units: values.details?.units,
      route: values.details?.route,
      location: values.details?.location,
      manufacturer: values.details?.manufacturer,
      instructions: values.details?.instructions,
      cvx: values.administrationDetails?.cvx,
      mvx: values.administrationDetails?.mvx,
      cptCodes: values.administrationDetails?.cptCodes,
      ndc: values.administrationDetails?.ndc,
      lot: values.administrationDetails?.lot,
      expDate: values.administrationDetails?.expDate,
    };
  };

  const onSaveAsQuickPick = async (overwriteId?: string): Promise<void> => {
    if (!quickPickName.trim()) {
      enqueueSnackbar('Quick pick name is required', { variant: 'error' });
      return;
    }
    if (!oystehrZambda) throw new Error('oystehrZambda was null');

    setQuickPickSaving(true);
    try {
      const quickPickData = buildQuickPickFromCurrentState();
      if (overwriteId) {
        await updateImmunizationQuickPick(oystehrZambda, overwriteId, quickPickData);
        enqueueSnackbar(`Quick pick "${quickPickName}" updated`, { variant: 'success' });
      } else {
        await createImmunizationQuickPick(oystehrZambda, { quickPick: quickPickData });
        enqueueSnackbar(`Quick pick "${quickPickName}" created`, { variant: 'success' });
      }
      setQuickPickDialogOpen(false);
      void refetchQuickPicks();
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
    } finally {
      setQuickPickSaving(false);
    }
  };

  const handleDeleteOrder = async (): Promise<void> => {
    try {
      await cancelOrder({ orderId: order.id });
      navigate(getImmunizationMARUrl(appointmentId!));
    } catch {
      enqueueSnackbar('An error occurred while deleting the immunization order. Please try again.', {
        variant: 'error',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const onSubmit = async (data: any): Promise<void> => {
    if (data.otherReason) {
      data.reason = data.otherReason;
    }
    await administerOrder({
      orderId: order.id,
      type: administrationTypeRef.current.type,
      ...(await cleanupProperties(data)),
    });
    navigate(getImmunizationMARUrl(appointmentId!));
  };

  const onAdministrationActionClick = async (administrationType: AdministrationType): Promise<void> => {
    administrationTypeRef.current = administrationType;
    if (await methods.trigger()) {
      setShowAdministrationConfirmationDialog(true);
    }
  };

  const requiredForAdministration = (value: string | undefined): boolean | string => {
    if (administrationTypeRef.current !== NOT_ADMINISTERED && (!value || value.length === 0)) {
      return REQUIRED_FIELD_ERROR_MESSAGE;
    }
    return true;
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
          <Stack spacing={2}>
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid xs={12} item>
                  <OrderDetailsSection />
                </Grid>
                <Grid xs={12} item>
                  <Typography
                    variant="h5"
                    sx={{
                      color: theme.palette.primary.dark,
                    }}
                  >
                    Administering immunization
                  </Typography>
                  {!isReadOnly && (
                    <QuickPicksButton
                      quickPicks={mergedQuickPicks}
                      getLabel={(qp) => qp.name}
                      onSelect={onQuickPickSelect}
                      showAddOption
                      isAdmin={isAdmin}
                      onAddOrUpdate={() => void openQuickPickDialog()}
                    />
                  )}
                </Grid>
                <Grid xs={3} item>
                  <TextInput
                    name="administrationDetails.lot"
                    label="LOT number"
                    required
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.lotNumber}
                  />
                </Grid>
                <Grid xs={3} item>
                  <TextInput
                    name="administrationDetails.ndc"
                    label="NDC code"
                    required
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.ndcCode}
                  />
                </Grid>
                <Grid xs={3} item>
                  <DateInput
                    name="administrationDetails.expDate"
                    label="Exp. Date"
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.expiredDate}
                  />
                </Grid>
                <Grid xs={3} item>
                  <TextInput
                    name="administrationDetails.mvx"
                    label="MVX code"
                    required
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.mvxCode}
                  />
                </Grid>
                <Grid xs={3} item>
                  <TextInput
                    name="administrationDetails.cvx"
                    label="CVX code"
                    required
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.cvxCode}
                  />
                </Grid>
                <Grid xs={6} item>
                  <ImmunizationCptCodesField methods={methods} isReadOnly={isReadOnly} />
                </Grid>
                <Grid xs={3} item>
                  <DateInput
                    name="administrationDetails.administeredDateTime"
                    label="Administered date"
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.administeredDate}
                  />
                </Grid>
                <Grid xs={3} item>
                  <TimeInput
                    name="administrationDetails.administeredDateTime"
                    label="Administered time"
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.administeredTime}
                  />
                </Grid>
                <Grid xs={6} item>
                  <Box
                    style={{
                      background: '#2169F514',
                      borderRadius: '8px',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <CheckboxInput
                      name="visGiven"
                      label="VIS was given to the patient"
                      required
                      validate={requiredForAdministration}
                      dataTestId={dataTestIds.vaccineDetailsPage.visCheckbox}
                    />
                  </Box>
                </Grid>
                <Grid xs={6} item>
                  <DateInput
                    name="administrationDetails.visGivenDate"
                    label="VIS given date"
                    required
                    validate={requiredForAdministration}
                    dataTestId={dataTestIds.vaccineDetailsPage.visGivenDate}
                  />
                </Grid>
                <Grid xs={12} item>
                  <Typography
                    variant="h5"
                    sx={{
                      color: theme.palette.primary.dark,
                    }}
                  >
                    Emergency contact
                  </Typography>
                </Grid>
                <Grid xs={4} item>
                  <SelectInput
                    name="administrationDetails.emergencyContact.relationship"
                    label="Relationship"
                    options={RELATIONSHIP_OPTIONS.map((option) => option.value)}
                    getOptionLabel={(option) =>
                      RELATIONSHIP_OPTIONS.find((opt) => opt.value === option)?.label ?? option
                    }
                    dataTestId={dataTestIds.vaccineDetailsPage.relationship}
                  />
                </Grid>
                <Grid xs={4} item>
                  <TextInput
                    name="administrationDetails.emergencyContact.fullName"
                    label="Full name"
                    dataTestId={dataTestIds.vaccineDetailsPage.fullName}
                  />
                </Grid>
                <Grid xs={4} item>
                  <PhoneInput
                    name="administrationDetails.emergencyContact.mobile"
                    label="Mobile"
                    dataTestId={dataTestIds.vaccineDetailsPage.mobile}
                  />
                </Grid>
                <Grid xs={12} item>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <OrderStatusChip status={order.status} />
                      {order.status === 'pending' && !isReadOnly && (
                        <>
                          <LoadingButton
                            variant="outlined"
                            color="error"
                            size="large"
                            loading={isDeleting}
                            onClick={() => setIsDeleteDialogOpen(true)}
                            sx={{
                              borderRadius: '20px',
                              textTransform: 'none',
                            }}
                          >
                            Delete Order
                          </LoadingButton>
                          <CustomDialog
                            open={isDeleteDialogOpen}
                            handleClose={() => setIsDeleteDialogOpen(false)}
                            title="Delete immunization order"
                            description="Are you sure you want to delete the immunization order?"
                            closeButtonText="Cancel"
                            closeButton={false}
                            handleConfirm={handleDeleteOrder}
                            confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                            confirmLoading={isDeleting}
                          />
                        </>
                      )}
                    </Stack>
                    <Stack direction="row">
                      <ButtonRounded
                        variant="outlined"
                        color="primary"
                        size="large"
                        onClick={async () => onAdministrationActionClick(NOT_ADMINISTERED)}
                        disabled={isReadOnly}
                        data-testid={dataTestIds.vaccineDetailsPage.notAdministeredButton}
                      >
                        Not Administered
                      </ButtonRounded>
                      <ButtonRounded
                        variant="outlined"
                        color="primary"
                        size="large"
                        onClick={async () => onAdministrationActionClick(PARTLY_ADMINISTERED)}
                        disabled={isReadOnly}
                        data-testid={dataTestIds.vaccineDetailsPage.partlyAdministeredButton}
                      >
                        Partly Administered
                      </ButtonRounded>
                      <ButtonRounded
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={async () => onAdministrationActionClick(ADMINISTERED)}
                        disabled={isReadOnly}
                        data-testid={dataTestIds.vaccineDetailsPage.administeredButton}
                      >
                        Administered
                      </ButtonRounded>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
          <AdministrationConfirmationDialog
            administrationType={administrationTypeRef.current}
            patientName={mappedData.patientName}
            medicationName={methods.getValues('details.medication.name')}
            dose={methods.getValues('details.dose')}
            unit={UNIT_OPTIONS.find((unit) => unit.value === methods.getValues('details.units'))?.label}
            route={ROUTE_OPTIONS.find((route) => route.code === methods.getValues('details.route'))?.name}
            open={showAdministrationConfirmationDialog}
            handleClose={() => {
              setShowAdministrationConfirmationDialog(false);
            }}
            handleConfirm={methods.handleSubmit(onSubmit)}
          />
        </fieldset>
      </form>

      <Dialog open={quickPickDialogOpen} onClose={() => setQuickPickDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save as Quick Pick</DialogTitle>
        <DialogContent>
          <MuiTextField
            autoFocus
            label="Quick pick name"
            fullWidth
            value={quickPickName}
            onChange={(e) => setQuickPickName(e.target.value)}
            sx={{ mt: 1 }}
          />
          {existingQuickPicks.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Or overwrite an existing quick pick:
              </Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                {existingQuickPicks.map((qp) => (
                  <ListItem key={qp.id} disablePadding>
                    <ListItemButton
                      selected={overwriteTarget?.id === qp.id}
                      onClick={() => {
                        setOverwriteTarget(qp);
                        setQuickPickName(qp.name);
                      }}
                    >
                      <ListItemText primary={qp.name} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickPickDialogOpen(false)}>Cancel</Button>
          <LoadingButton
            loading={quickPickSaving}
            variant="contained"
            onClick={() => void onSaveAsQuickPick(overwriteTarget?.id)}
          >
            {overwriteTarget ? 'Overwrite' : 'Save'}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </FormProvider>
  );
};

// Wrapper to make cptCodes reactive via useWatch
const ImmunizationCptCodesField: React.FC<{ methods: ReturnType<typeof useForm>; isReadOnly?: boolean }> = ({
  methods,
  isReadOnly,
}) => {
  const cptCodes = useWatch({ control: methods.control, name: 'administrationDetails.cptCodes' }) ?? [];
  return (
    <CptCodesInput
      cptCodes={cptCodes}
      onChange={(codes) => methods.setValue('administrationDetails.cptCodes', codes)}
      isEditable={!isReadOnly}
    />
  );
};
