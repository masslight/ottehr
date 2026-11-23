import { LoadingButton } from '@mui/lab';
import { Divider, Skeleton, Stack } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { Sentence } from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import {
  useAdministerImmunizationOrder,
  useCancelImmunizationOrder,
} from 'src/features/visits/in-person/hooks/useImmunization';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPickSaveDialogs } from 'src/features/visits/shared/components/QuickPickSaveDialogs';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { cleanupProperties } from 'src/helpers/misc.helper';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useGetPatientAccount } from 'src/hooks/useGetPatient';
import { BASE_ROUTE_OPTIONS } from 'src/shared/utils/options';
import { BASE_UNIT_OPTIONS } from 'utils/lib/fhir/medication-administration';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
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
import { AdministrationConfirmationDialog } from './AdministrationConfirmationDialog';
import {
  administrationErrors,
  applyImmunizationQuickPick,
  immunizationFormFromOrder,
  ImmunizationFormValues,
  immunizationOrderErrors,
} from './immunizationForm';
import { ImmunizationSectionLabel, ImmunizationSentences } from './ImmunizationSentences';
import { OrderStatusChip } from './OrderStatusChip';

interface Props {
  order: ImmunizationOrder;
  onFinished?: () => void;
}

/** The reason the confirmation dialog asks for when the order isn't marked administered. */
interface ReasonValues {
  reason?: string;
  otherReason: string;
}

/** The order as the form holds it. The dose is taken to be given now unless a date was entered with the order. */
const formValuesFromOrder = (order: ImmunizationOrder): ImmunizationFormValues => {
  const values = immunizationFormFromOrder(order);
  return {
    ...values,
    administrationDetails: {
      ...values.administrationDetails,
      administeredDateTime: getInitialAdministeredDateTime(order),
      visGiven: order.administrationDetails?.visGiven ?? false,
    },
  };
};

export const VaccineDetailsCard: React.FC<Props> = ({ order, onFinished }) => {
  const [values, setValues] = useState(() => formValuesFromOrder(order));
  // The dialog's reason fields are react-hook-form inputs, so they have a form of their own.
  const reasonForm = useForm<ReasonValues>({ defaultValues: { reason: order.reason, otherReason: '' } });
  useEffect(() => {
    setValues(formValuesFromOrder(order));
    reasonForm.reset({ reason: order.reason, otherReason: '' });
  }, [order, reasonForm]);

  const navigate = useNavigate();
  const [showAdministrationConfirmationDialog, setShowAdministrationConfirmationDialog] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [administrationType, setAdministrationType] = useState<AdministrationType>(ADMINISTERED);
  const [attempted, setAttempted] = useState(false);
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
    openQuickPickDialog,
    onSaveAsQuickPick,
  } = useImmunizationQuickPickManagement({ getValues: () => values });
  // On an order already placed a quick pick fills only the administration details.
  const onQuickPickSelect = (quickPick: ImmunizationQuickPickData): void =>
    setValues(applyImmunizationQuickPick(values, quickPick, false));

  /** What still has to be filled in before the order can be marked this way. */
  const errorsFor = (type: AdministrationType): string[] => [
    ...immunizationOrderErrors(values),
    ...(type === NOT_ADMINISTERED ? [] : administrationErrors(values, order.administrationDetails?.cvx)),
  ];

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

  const onSubmit = async ({ reason, otherReason }: ReasonValues): Promise<void> => {
    const { details, administrationDetails } = cleanupProperties(values) ?? {};
    try {
      await administerOrder({
        orderId: order.id,
        type: administrationType.type,
        reason: otherReason?.trim() ? otherReason : reason,
        details,
        administrationDetails: administrationDetails ?? {},
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

  const onAdministrationActionClick = (type: AdministrationType): void => {
    setAdministrationType(type);
    setAttempted(true);
    if (errorsFor(type).length > 0) return;
    setShowAdministrationConfirmationDialog(true);
  };

  return (
    <>
      <AccordionCard>
        <Stack spacing={1.5} style={{ padding: '24px' }}>
          <ImmunizationSectionLabel>Order</ImmunizationSectionLabel>
          <ImmunizationSentences
            values={values}
            onChange={setValues}
            quickPicks={mergedQuickPicks}
            quickPicksLoading={mergedQuickPicksLoading}
            onQuickPick={onQuickPickSelect}
            onSaveQuickPick={isAdmin ? () => void openQuickPickDialog() : undefined}
            errors={attempted ? errorsFor(administrationType) : []}
            readOnly={isReadOnly}
            needAdministration
          >
            <Sentence>
              Emergency contact:{' '}
              {isEmergencyContactLoading ? (
                <Skeleton variant="text" width={300} sx={{ display: 'inline-block' }} />
              ) : (
                <span data-testid={dataTestIds.vaccineDetailsPage.emergencyContact}>{emergencyContactText}</span>
              )}
            </Sentence>
          </ImmunizationSentences>

          <Divider orientation="horizontal" />

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
                onClick={() => onAdministrationActionClick(NOT_ADMINISTERED)}
                disabled={isReadOnly}
                data-testid={dataTestIds.vaccineDetailsPage.notAdministeredButton}
              >
                Not Administered
              </ButtonRounded>
              <ButtonRounded
                variant="outlined"
                color="primary"
                size="large"
                onClick={() => onAdministrationActionClick(PARTLY_ADMINISTERED)}
                disabled={isReadOnly}
                data-testid={dataTestIds.vaccineDetailsPage.partlyAdministeredButton}
              >
                Partly Administered
              </ButtonRounded>
              <ButtonRounded
                variant="contained"
                color="primary"
                size="large"
                onClick={() => onAdministrationActionClick(ADMINISTERED)}
                disabled={isReadOnly}
                data-testid={dataTestIds.vaccineDetailsPage.administeredButton}
              >
                Administered
              </ButtonRounded>
            </Stack>
          </Stack>
        </Stack>
      </AccordionCard>

      <FormProvider {...reasonForm}>
        <AdministrationConfirmationDialog
          administrationType={administrationType}
          patientName={mappedData.patientName}
          medicationName={values.details.medication?.name}
          dose={values.details.dose ?? ''}
          unit={BASE_UNIT_OPTIONS.find((unit) => unit.value === values.details.units)?.label}
          route={BASE_ROUTE_OPTIONS.find((route) => route.code === values.details.route)?.name}
          open={showAdministrationConfirmationDialog}
          handleClose={() => {
            setShowAdministrationConfirmationDialog(false);
          }}
          handleConfirm={reasonForm.handleSubmit(onSubmit)}
        />
      </FormProvider>

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
    </>
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
