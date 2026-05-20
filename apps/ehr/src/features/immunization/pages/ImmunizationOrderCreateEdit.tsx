import { LoadingButton } from '@mui/lab';
import {
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
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { CustomDialog } from 'src/components/dialogs';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { WarningBlock } from 'src/features/visits/in-person/components/WarningBlock';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPicksButton } from 'src/features/visits/shared/components/QuickPicksButton';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { usePendingQuickPick } from 'src/hooks/usePendingQuickPick';
import { ImmunizationQuickPickData, RoleType } from 'utils';
import { PageHeader } from '../../visits/in-person/components/medication-administration/PageHeader';
import {
  useCancelImmunizationOrder,
  useCreateUpdateImmunizationOrder,
  useGetImmunizationOrders,
} from '../../visits/in-person/hooks/useImmunization';
import { OrderDetailsSection } from '../components/OrderDetailsSection';
import { OrderHistoryTable } from '../components/OrderHistoryTable';
import { useImmunizationQuickPickManagement } from '../hooks/useImmunizationQuickPickManagement';

export const ImmunizationOrderCreateEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id: appointmentId, orderId } = useParams();
  const {
    resources: { encounter, patient },
  } = useAppointmentData(appointmentId);

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const [isOrderSaved, setIsOrderSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutateAsync: createUpdateOrder, isPending: isOrderSaving } = useCreateUpdateImmunizationOrder();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder();

  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator]) ?? false;
  const currentUserProviderId = currentUser?.profile?.split('/')[1];
  const currentUserHasProviderRole = currentUser?.hasRole?.([RoleType.Provider]);
  const defaultProviderId = currentUserHasProviderRole ? currentUserProviderId : undefined;

  const onSubmit = async (data: any): Promise<void> => {
    await createUpdateOrder({
      encounterId: encounter?.id ?? '',
      orderId: orderId,
      ...(await cleanupProperties(data)),
    });
    setIsOrderSaved(true);
    navigate(getImmunizationMARUrl(appointmentId!));
  };

  const handleDeleteOrder = async (): Promise<void> => {
    if (!orderId) return;
    try {
      await cancelOrder({ orderId });
      navigate(getImmunizationMARUrl(appointmentId!));
    } catch {
      setIsDeleteDialogOpen(false);
      enqueueSnackbar('An error occurred while deleting the immunization order. Please try again.', {
        variant: 'error',
      });
    }
  };

  const { data: ordersResponse, isLoading: isOrderLoading } = useGetImmunizationOrders({
    orderId: orderId,
  });

  const methods = useForm();

  const {
    mergedQuickPicks,
    quickPickDialogOpen,
    setQuickPickDialogOpen,
    quickPickName,
    setQuickPickName,
    existingQuickPicks,
    quickPickSaving,
    overwriteTarget,
    setOverwriteTarget,
    onQuickPickSelect,
    openQuickPickDialog,
    onSaveAsQuickPick,
  } = useImmunizationQuickPickManagement({ methods, applyOrderDetails: true });

  useEffect(() => {
    const order = ordersResponse?.orders?.find((order) => order.id === orderId);
    methods.reset(order);
  }, [methods, ordersResponse, orderId]);

  useEffect(() => {
    if (!orderId && defaultProviderId) {
      methods.reset({
        details: {
          ...methods.getValues('details'),
          orderedProvider: {
            id: defaultProviderId,
            name: currentUser?.userName,
          },
        },
      });
    }
  }, [methods, defaultProviderId, orderId, currentUser]);

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

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <BaseBreadcrumbs
            sectionName={orderId ? 'Edit Immunization Order' : 'Order Immunization'}
            baseCrumb={{ label: 'Immunizations', path: getImmunizationMARUrl(appointmentId ?? '') }}
          />
          <PageHeader
            title={orderId ? 'Edit Immunization Order' : 'Order Immunization'}
            variant="h3"
            component="h1"
            dataTestId={dataTestIds.orderVaccinePage.title}
          />

          {!orderId && (
            <QuickPicksButton
              quickPicks={mergedQuickPicks}
              getLabel={(qp) => qp.name}
              onSelect={onQuickPickSelect}
              showAddOption
              isAdmin={isAdmin}
              onAddOrUpdate={() => void openQuickPickDialog()}
              searchable
            />
          )}

          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid xs={12} item>
                <OrderDetailsSection />
              </Grid>
              <Grid xs={12} item>
                <WarningBlock
                  title="Safety Alert"
                  text="Vaccine orders do not automatically check for patient allergies (unlike medication orders). Before proceeding, please manually review the patient's allergies and confirm there is no risk of allergy to the vaccine or its components."
                />
              </Grid>
              <Grid xs={12} item>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1}>
                    <ButtonRounded
                      variant="outlined"
                      color="primary"
                      size="large"
                      onClick={() => navigate(getImmunizationMARUrl(appointmentId!))}
                    >
                      Back
                    </ButtonRounded>
                    {orderId && (
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
                  <LoadingButton
                    type="submit"
                    disabled={isOrderLoading || isOrderSaved}
                    loading={isOrderSaving}
                    variant="contained"
                    color="primary"
                    size="large"
                    sx={{
                      borderRadius: '20px',
                      textTransform: 'none',
                    }}
                    data-testid={dataTestIds.orderVaccinePage.orderVaccineButton}
                  >
                    {orderId ? 'Save changes' : 'Order Immunization'}
                  </LoadingButton>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
          <AccordionCard
            label="Immunization history"
            collapsed={isImmunizationHistoryCollapsed}
            onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
            withBorder={false}
          >
            <OrderHistoryTable showActions={false} administeredOnly immunizationInput={{ patientId: patient?.id }} />
          </AccordionCard>
        </Stack>
      </form>

      {/* Save as Quick Pick Dialog */}
      <Dialog open={quickPickDialogOpen} onClose={() => setQuickPickDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save as Quick Pick</DialogTitle>
        <DialogContent>
          <TextField
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
