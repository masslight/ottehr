import { LoadingButton } from '@mui/lab';
import { Divider, Stack } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { UnsavedDraftWarning } from 'src/components/UnsavedDraftWarning';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { WarningBlock } from 'src/features/visits/in-person/components/WarningBlock';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPickSaveDialogs } from 'src/features/visits/shared/components/QuickPickSaveDialogs';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { enqueueOrderDeleteWarnings } from 'src/features/visits/shared/utils/orderDeleteWarnings';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { usePendingQuickPick } from 'src/hooks/usePendingQuickPick';
import { useImmunizationOrderStore, useMarkDraftNavigatedAway } from 'src/state/draft-data.store';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PageHeader } from '../../visits/in-person/components/medication-administration/PageHeader';
import {
  useCancelImmunizationOrder,
  useCreateUpdateImmunizationOrder,
  useGetImmunizationOrders,
} from '../../visits/in-person/hooks/useImmunization';
import {
  applyImmunizationQuickPick,
  emptyImmunizationForm,
  immunizationFormFromOrder,
  ImmunizationFormValues,
  immunizationOrderErrors,
  immunizationOrderRequest,
} from '../components/immunizationForm';
import { ImmunizationSectionLabel, ImmunizationSentences } from '../components/ImmunizationSentences';
import { OrderHistoryTable } from '../components/OrderHistoryTable';
import { useImmunizationQuickPickManagement } from '../hooks/useImmunizationQuickPickManagement';

const ROUNDED_BUTTON_SX = { borderRadius: '20px', textTransform: 'none' } as const;

interface ImmunizationOrderCreateEditProps {
  orderId?: string;
  onFinished?: () => void;
}

export const ImmunizationOrderCreateEdit: React.FC<ImmunizationOrderCreateEditProps> = ({
  orderId: orderIdProp,
  onFinished,
}) => {
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const { id: appointmentId, orderId: orderIdFromUrl } = useParams();
  const orderId = orderIdProp ?? orderIdFromUrl;
  const {
    resources: { encounter, patient },
  } = useAppointmentData(appointmentId);

  const isCreating = !orderId;
  const encounterId = encounter?.id ?? '';

  const { setDraft, clearDraft, hasDraft, getDraft } = useImmunizationOrderStore();
  const draft = getDraft(encounterId);

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const [isOrderSaved, setIsOrderSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutateAsync: createUpdateOrder, isPending: isOrderSaving } = useCreateUpdateImmunizationOrder();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder(encounterId);

  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator]) ?? false;
  const currentUserProviderId = getIdFromReference(currentUser?.profile);
  const currentUserHasProviderRole = currentUser?.hasRole?.([RoleType.Provider]);
  const currentUserName = currentUser?.userName;
  const defaultProvider = useMemo(
    () =>
      currentUserHasProviderRole && currentUserProviderId
        ? { id: currentUserProviderId, name: currentUserName ?? '' }
        : undefined,
    [currentUserHasProviderRole, currentUserProviderId, currentUserName]
  );

  useMarkDraftNavigatedAway({ encounterId, setDraft, hasDraft });

  const finish = onFinished ?? ((): void => navigate(getImmunizationMARUrl(appointmentId!)));

  // What has been entered. A new order starts from its draft; the order being edited is loaded below.
  const [entered, setEntered] = useState<ImmunizationFormValues>(() => {
    const empty = emptyImmunizationForm();
    if (!isCreating) return empty;
    const { administrationDetails, hasNavigatedAway: _hasNavigatedAway, ...details } = draft;
    return {
      details: { ...empty.details, ...details },
      administrationDetails: { ...empty.administrationDetails, ...administrationDetails },
    };
  });
  // The form: on a new order the current provider is "Ordered by" until another is picked. A default is not a
  // change of the user's, so it starts no draft.
  const values = useMemo<ImmunizationFormValues>(
    () =>
      isCreating && defaultProvider && !entered.details.orderedProvider
        ? { ...entered, details: { ...entered.details, orderedProvider: defaultProvider } }
        : entered,
    [isCreating, defaultProvider, entered]
  );
  const [dirty, setDirty] = useState(false);
  const [orderAttempted, setOrderAttempted] = useState(false);

  /** A change of the user's: a new order's draft follows it. */
  const changeValues = (next: ImmunizationFormValues): void => {
    setDirty(true);
    setEntered(next);
  };

  useEffect(() => {
    if (!isCreating || !encounterId || !dirty || isOrderSaved) return;
    setDraft(encounterId, { ...values.details, administrationDetails: values.administrationDetails });
  }, [isCreating, encounterId, dirty, isOrderSaved, values, setDraft]);

  const { data: ordersResponse, isLoading: isOrderLoading } = useGetImmunizationOrders({ orderId });
  useEffect(() => {
    if (!orderId) return;
    const order = ordersResponse?.orders?.find((order) => order.id === orderId);
    if (order) setEntered(immunizationFormFromOrder(order));
  }, [ordersResponse, orderId]);

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

  const onQuickPickSelect = (quickPick: ImmunizationQuickPickData): void =>
    changeValues(applyImmunizationQuickPick(values, quickPick, true));
  // the command palette and a pending quick pick call the latest one
  const onQuickPickSelectRef = useRef(onQuickPickSelect);
  onQuickPickSelectRef.current = onQuickPickSelect;

  const commandPaletteItems = useMemo(
    () =>
      orderId || isReadOnly
        ? []
        : mergedQuickPicks.map((quickPick) => {
            const doseAndUnits = quickPick.dose && quickPick.units ? `${quickPick.dose} ${quickPick.units}` : undefined;

            return {
              id: `immunization-${quickPick.id ?? quickPick.name}`,
              label: [quickPick.name, doseAndUnits].filter(Boolean).join(', '),
              category: 'Add Immunization',
              onSelect: () => onQuickPickSelectRef.current(quickPick),
            };
          }),
    [isReadOnly, mergedQuickPicks, orderId]
  );
  useCommandPaletteSource('immunization-quick-picks', commandPaletteItems);

  const handlePendingQuickPick = useCallback(
    (payload: ImmunizationQuickPickData) => {
      if (isReadOnly) {
        return;
      }
      onQuickPickSelectRef.current(payload);
    },
    [isReadOnly]
  );
  usePendingQuickPick('immunizations', handlePendingQuickPick, !isOrderLoading);

  const order = async (): Promise<void> => {
    setOrderAttempted(true);
    if (immunizationOrderErrors(values).length > 0) return;
    try {
      await createUpdateOrder(immunizationOrderRequest(values, encounterId, orderId));
    } catch (error) {
      enqueueSnackbar(getApiError({ error, defaultError: 'An error occurred while saving the immunization order.' }), {
        variant: 'error',
      });
      return;
    }
    setIsOrderSaved(true);
    if (isCreating && encounterId) clearDraft(encounterId);
    finish();
  };

  const handleDeleteOrder = async (): Promise<void> => {
    if (!orderId) return;
    try {
      const response = await cancelOrder({ orderId });
      enqueueOrderDeleteWarnings(response);
      finish();
    } catch {
      setIsDeleteDialogOpen(false);
      enqueueSnackbar('An error occurred while deleting the immunization order. Please try again.', {
        variant: 'error',
      });
    }
  };

  const handleBack = (): void => {
    if (isCreating && encounterId) clearDraft(encounterId);
    finish();
  };

  const handleClearForm = (): void => {
    clearDraft(encounterId);
    setDirty(false);
    setOrderAttempted(false);
    setEntered(emptyImmunizationForm());
  };

  return (
    <>
      <Stack spacing={2}>
        {!isInlineFlow && (
          <BaseBreadcrumbs
            sectionName={orderId ? 'Edit Immunization Order' : 'Order Immunization'}
            baseCrumb={{ label: 'Immunizations', path: getImmunizationMARUrl(appointmentId ?? '') }}
          />
        )}
        <PageHeader
          title={orderId ? 'Edit Immunization Order' : 'Order Immunization'}
          variant="h3"
          component="h1"
          dataTestId={dataTestIds.orderVaccinePage.title}
        />

        {isCreating && hasDraft(encounterId) && (
          <UnsavedDraftWarning
            message={
              draft.hasNavigatedAway
                ? 'Your previously entered data has been restored. Click "Clear Form" to start fresh.'
                : 'You have an immunization order in progress. Your draft will be saved.'
            }
          />
        )}

        <AccordionCard>
          <Stack spacing={1.5} style={{ padding: '24px' }}>
            <ImmunizationSectionLabel>Immunizations</ImmunizationSectionLabel>
            <ImmunizationSentences
              values={values}
              onChange={changeValues}
              // Quick picks start a new order; an order being edited keeps what it has.
              quickPicks={isCreating ? mergedQuickPicks : undefined}
              quickPicksLoading={mergedQuickPicksLoading}
              onQuickPick={onQuickPickSelect}
              onSaveQuickPick={isAdmin && isCreating ? () => void openQuickPickDialog() : undefined}
              errors={orderAttempted ? immunizationOrderErrors(values) : []}
              readOnly={isReadOnly}
              collapseAdministration
            />
            <WarningBlock
              title="Safety Alert"
              text="Vaccine orders do not automatically check for patient allergies (unlike medication orders). Before proceeding, please manually review the patient's allergies and confirm there is no risk of allergy to the vaccine or its components."
            />

            <Divider orientation="horizontal" />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1}>
                <ButtonRounded variant="outlined" color="primary" size="large" onClick={handleBack}>
                  Back
                </ButtonRounded>
                {isCreating && hasDraft(encounterId) && (
                  <ButtonRounded variant="outlined" color="primary" size="large" onClick={handleClearForm}>
                    Clear Form
                  </ButtonRounded>
                )}
                {orderId && (
                  <>
                    <LoadingButton
                      variant="outlined"
                      color="error"
                      size="large"
                      loading={isDeleting}
                      onClick={() => setIsDeleteDialogOpen(true)}
                      sx={ROUNDED_BUTTON_SX}
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
              <LoadingButton
                disabled={isOrderLoading || isOrderSaved || isReadOnly}
                loading={isOrderSaving}
                variant="contained"
                color="primary"
                size="large"
                sx={ROUNDED_BUTTON_SX}
                onClick={() => void order()}
                data-testid={dataTestIds.orderVaccinePage.orderVaccineButton}
              >
                {orderId ? 'Save changes' : 'Order Immunization'}
              </LoadingButton>
            </Stack>
          </Stack>
        </AccordionCard>

        <AccordionCard
          label="Immunization history"
          collapsed={isImmunizationHistoryCollapsed}
          onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
          withBorder={false}
        >
          <OrderHistoryTable showActions={false} administeredOnly immunizationInput={{ patientId: patient?.id }} />
        </AccordionCard>
      </Stack>

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
