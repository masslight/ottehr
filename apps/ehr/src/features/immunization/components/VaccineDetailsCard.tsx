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
import { RoleType } from 'utils/lib/types/api/user.types';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { effectiveVfcEligibility } from 'utils/lib/types/data/immunization/vfc';
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
import { useVfcEligibility } from '../hooks/useVaccineInventory';
import { AdministrationConfirmationDialog } from './AdministrationConfirmationDialog';
import {
  administrationErrors,
  applyImmunizationQuickPick,
  ImmunizationLine,
  immunizationLineErrors,
  immunizationLineFrom,
} from './immunizationLines';
import { ImmunizationSectionLabel, ImmunizationSentences } from './ImmunizationSentences';
import { OrderStatusChip } from './OrderStatusChip';
import { needsVfcConfirmation, shownVfcEligibility } from './VfcEligibilityBox';

interface Props {
  order: ImmunizationOrder;
  onFinished?: () => void;
}

/** The reason the confirmation dialog asks for when the order isn't marked administered. */
interface ReasonValues {
  reason?: string;
  otherReason: string;
  /** The dialog's "Confirm VFC eligibility" box. */
  confirmVfc: boolean;
}

const lineFromOrder = (order: ImmunizationOrder): ImmunizationLine =>
  immunizationLineFrom({
    details: order.details,
    administrationDetails: {
      ...order.administrationDetails,
      // The server records the patient's emergency contact on administration.
      emergencyContact: undefined,
      administeredDateTime: getInitialAdministeredDateTime(order),
      visGiven: order.administrationDetails?.visGiven ?? false,
    },
  });

export const VaccineDetailsCard: React.FC<Props> = ({ order, onFinished }) => {
  // The order as one line, as the order page holds it.
  const [line, setLine] = useState(() => lineFromOrder(order));
  useEffect(() => {
    setLine(lineFromOrder(order));
  }, [order]);
  const reasonForm = useForm<ReasonValues>({ defaultValues: { otherReason: '', confirmVfc: true } });

  const navigate = useNavigate();
  const [showAdministrationConfirmationDialog, setShowAdministrationConfirmationDialog] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [administrationType, setAdministrationType] = useState<AdministrationType>(ADMINISTERED);
  const [attempted, setAttempted] = useState(false);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { id: appointmentId } = useParams();
  const { mappedData, resources } = useAppointmentData(appointmentId);
  const { data: vfc } = useVfcEligibility(order.encounterId || undefined);
  // The lots and borrowing go by the eligibility line's category; an adult is never eligible.
  const vfcEligibility = effectiveVfcEligibility(shownVfcEligibility(vfc), resources?.patient?.birthDate);
  const apiClient = useOystehrAPIClient();
  const showsPatientEmergencyContact = order.status === 'pending' || order.status === 'administered-not';
  const { data: patientAccount, isError: isPatientAccountError } = useGetPatientAccount({
    apiClient,
    patientId: showsPatientEmergencyContact ? resources?.patient?.id ?? null : null,
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
  const isAdmin = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;

  const {
    mergedQuickPicks,
    quickPickDialogOpen,
    setQuickPickDialogOpen,
    quickPickName,
    setQuickPickName,
    existingQuickPicks,
    quickPickSaving,
    openQuickPickDialog,
    onSaveAsQuickPick,
  } = useImmunizationQuickPickManagement({ getValues: () => line });
  const onQuickPickSelect = (quickPick: Parameters<typeof applyImmunizationQuickPick>[1]): void =>
    setLine((current) => applyImmunizationQuickPick(current, quickPick, true));

  const errorsFor = (type: AdministrationType): string[] => [
    ...immunizationLineErrors(line),
    ...administrationErrors(line, type !== NOT_ADMINISTERED),
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
    const data = {
      ...order,
      details: line.details,
      administrationDetails: line.administrationDetails,
      reason: otherReason?.trim() ? otherReason : reason,
      otherReason,
    };
    try {
      await administerOrder({
        orderId: order.id,
        type: administrationType.type,
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

  const onAdministrationActionClick = (type: AdministrationType): void => {
    setAdministrationType(type);
    setAttempted(true);
    if (errorsFor(type).length > 0) return;
    reasonForm.setValue('confirmVfc', true);
    setShowAdministrationConfirmationDialog(true);
  };

  return (
    <>
      <AccordionCard>
        <Stack spacing={1.5} style={{ padding: '24px' }}>
          <ImmunizationSectionLabel>Order</ImmunizationSectionLabel>
          <ImmunizationSentences
            line={line}
            index={0}
            onChange={setLine}
            quickPicks={mergedQuickPicks}
            onQuickPick={onQuickPickSelect}
            onSaveQuickPick={isAdmin ? () => void openQuickPickDialog() : undefined}
            errors={attempted ? errorsFor(administrationType) : []}
            readOnly={isReadOnly}
            needAdministration
            locationId={resources?.location?.id}
            vfcEligibility={vfcEligibility}
            patientFirstName={resources?.patient?.firstName}
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

      {/* The dialog's reason fields are react-hook-form inputs, so they get a form of their own. */}
      <FormProvider {...reasonForm}>
        <AdministrationConfirmationDialog
          administrationType={administrationType}
          patientName={mappedData.patientName}
          medicationName={line.details.medication?.name}
          dose={line.details.dose ?? ''}
          unit={BASE_UNIT_OPTIONS.find((unit) => unit.value === line.details.units)?.label}
          route={BASE_ROUTE_OPTIONS.find((route) => route.code === line.details.route)?.name}
          open={showAdministrationConfirmationDialog}
          handleClose={() => {
            setShowAdministrationConfirmationDialog(false);
          }}
          handleConfirm={reasonForm.handleSubmit(onSubmit)}
          encounterId={order.encounterId || undefined}
          vfcUnconfirmed={
            administrationType !== NOT_ADMINISTERED &&
            needsVfcConfirmation(vfc, line.administrationDetails.fundingSource)
          }
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
