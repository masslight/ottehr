import { LoadingButton } from '@mui/lab';
import { Grid, Paper, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import {
  useAdministerImmunizationOrder,
  useCancelImmunizationOrder,
} from 'src/features/visits/in-person/hooks/useImmunization';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPickSaveDialogs } from 'src/features/visits/shared/components/QuickPickSaveDialogs';
import { QuickPicksButton } from 'src/features/visits/shared/components/QuickPicksButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { cleanupProperties } from 'src/helpers/misc.helper';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useGetPatientAccount } from 'src/hooks/useGetPatient';
import { BASE_ROUTE_OPTIONS } from 'src/shared/utils/options';
import { BASE_UNIT_OPTIONS } from 'utils/lib/fhir/medication-administration';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { RoleType } from 'utils/lib/types/api/user.types';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { enqueueOrderDeleteWarnings } from '../../visits/shared/utils/orderDeleteWarnings';
import {
  ADMINISTERED,
  AdministrationType,
  formatPatientEmergencyContact,
  formatRecordedEmergencyContact,
  NOT_ADMINISTERED,
  PARTLY_ADMINISTERED,
} from '../common';
import { useImmunizationQuickPickManagement } from '../hooks/useImmunizationQuickPickManagement';
import { AdministeringImmunizationFields } from './AdministeringImmunizationFields';
import { AdministrationConfirmationDialog } from './AdministrationConfirmationDialog';
import { OrderDetailsSection } from './OrderDetailsSection';
import { OrderStatusChip } from './OrderStatusChip';

interface Props {
  order: ImmunizationOrder;
  onFinished?: () => void;
}

export const VaccineDetailsCard: React.FC<Props> = ({ order, onFinished }) => {
  const methods = useForm();
  useEffect(() => {
    methods.reset({
      ...order,
      administrationDetails: {
        ...order.administrationDetails,
        emergencyContact: undefined,
        administeredDateTime: getInitialAdministeredDateTime(order),
        visGiven: order.administrationDetails?.visGiven ?? false,
      },
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
  const {
    mappedData,
    resources: { patient },
  } = useAppointmentData(appointmentId);
  const apiClient = useOystehrAPIClient();
  const showsPatientEmergencyContact = order.status === 'pending' || order.status === 'administered-not';
  const { data: patientAccount, isError: isPatientAccountError } = useGetPatientAccount({
    apiClient,
    patientId: showsPatientEmergencyContact ? patient?.id ?? null : null,
  });
  const isEmergencyContactLoading = showsPatientEmergencyContact && !patientAccount && !isPatientAccountError;
  const emergencyContact = showsPatientEmergencyContact
    ? formatPatientEmergencyContact(patientAccount?.emergencyContactResource)
    : formatRecordedEmergencyContact(order.administrationDetails?.emergencyContact);
  const emergencyContactText = isPatientAccountError
    ? 'Could not load emergency contact'
    : emergencyContact ?? 'Not provided';

  const { mutateAsync: administerOrder } = useAdministerImmunizationOrder();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder(order.encounterId);
  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator]) ?? false;

  const {
    mergedQuickPicks,
    mergedQuickPicksLoading,
    quickPickDialogOpen,
    setQuickPickDialogOpen,
    quickPickName,
    setQuickPickName,
    existingQuickPicks,
    quickPickSaving,
    onQuickPickSelect,
    openQuickPickDialog,
    onSaveAsQuickPick,
  } = useImmunizationQuickPickManagement({ methods, applyOrderDetails: false });

  const handleDeleteOrder = async (): Promise<void> => {
    try {
      const response = await cancelOrder({ orderId: order.id });
      enqueueOrderDeleteWarnings(response);
      if (onFinished) {
        onFinished();
      } else {
        navigate(getImmunizationMARUrl(appointmentId!));
      }
    } catch {
      enqueueSnackbar('An error occurred while deleting the immunization order. Please try again.', {
        variant: 'error',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const onSubmit = async (data: any): Promise<void> => {
    if (data.otherReason?.trim()) {
      data.reason = data.otherReason;
    }
    try {
      await administerOrder({
        orderId: order.id,
        type: administrationTypeRef.current.type,
        ...(await cleanupProperties(data)),
      });
      if (onFinished) {
        onFinished();
      } else {
        navigate(getImmunizationMARUrl(appointmentId!));
      }
    } catch (error) {
      enqueueSnackbar(getApiError({ error, defaultError: 'An error occurred. Please try again.' }), {
        variant: 'error',
      });
      throw error;
    }
  };

  const onAdministrationActionClick = async (administrationType: AdministrationType): Promise<void> => {
    administrationTypeRef.current = administrationType;
    if (await methods.trigger()) {
      setShowAdministrationConfirmationDialog(true);
    }
  };

  const requiredForAdministration = (value: string | undefined): boolean | string => {
    if (administrationTypeRef.current !== NOT_ADMINISTERED && (typeof value === 'string' ? !value.trim() : !value)) {
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
                      loading={mergedQuickPicksLoading}
                      getLabel={(qp) => qp.name}
                      onSelect={onQuickPickSelect}
                      showAddOption
                      isAdmin={isAdmin}
                      onAddOrUpdate={() => void openQuickPickDialog()}
                      searchable
                    />
                  )}
                </Grid>
                <AdministeringImmunizationFields validate={requiredForAdministration} isReadOnly={isReadOnly} />
                <Grid xs={12} item>
                  <Typography
                    variant="h5"
                    sx={{
                      color: theme.palette.primary.dark,
                    }}
                  >
                    Emergency contact
                  </Typography>
                  {isEmergencyContactLoading ? (
                    <Skeleton width={300} />
                  ) : (
                    <Typography data-testid={dataTestIds.vaccineDetailsPage.emergencyContact}>
                      {emergencyContactText}
                    </Typography>
                  )}
                </Grid>
                <Grid xs={12} item>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <OrderStatusChip status={order.status} />
                      {order.status !== 'cancelled' && !isReadOnly && (
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
            unit={BASE_UNIT_OPTIONS.find((unit) => unit.value === methods.getValues('details.units'))?.label}
            route={BASE_ROUTE_OPTIONS.find((route) => route.code === methods.getValues('details.route'))?.name}
            open={showAdministrationConfirmationDialog}
            handleClose={() => {
              setShowAdministrationConfirmationDialog(false);
            }}
            handleConfirm={methods.handleSubmit(onSubmit)}
          />
        </fieldset>
      </form>

      <QuickPickSaveDialogs
        open={quickPickDialogOpen}
        name={quickPickName}
        onNameChange={setQuickPickName}
        existingQuickPicks={existingQuickPicks}
        saving={quickPickSaving}
        onClose={() => setQuickPickDialogOpen(false)}
        onSave={(overwriteId) => void onSaveAsQuickPick(overwriteId)}
        entityLabel="immunization"
      />
    </FormProvider>
  );
};

function getInitialAdministeredDateTime(order: ImmunizationOrder): string {
  const now = DateTime.now();
  const fromOrder = order.status === 'pending' ? order.administrationDetails?.administeredDateTime : undefined;
  if (!fromOrder) return now.toISO();
  // a date picked without a time on the order screen gets the current time instead of midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromOrder)) {
    return DateTime.fromISO(fromOrder).set({ hour: now.hour, minute: now.minute, second: 0, millisecond: 0 }).toISO()!;
  }
  return fromOrder;
}
