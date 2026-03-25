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
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { createImmunizationQuickPick, getImmunizationQuickPicks, updateImmunizationQuickPick } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { CustomDialog } from 'src/components/dialogs';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { WarningBlock } from 'src/features/visits/in-person/components/WarningBlock';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { QuickPicksButton } from 'src/features/visits/shared/components/QuickPicksButton';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useMergedImmunizationQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { ImmunizationQuickPickData, RoleType } from 'utils';
import { PageHeader } from '../../visits/in-person/components/medication-administration/PageHeader';
import {
  useCancelImmunizationOrder,
  useCreateUpdateImmunizationOrder,
  useGetImmunizationOrders,
} from '../../visits/in-person/hooks/useImmunization';
import { OrderDetailsSection } from '../components/OrderDetailsSection';
import { OrderHistoryTable } from '../components/OrderHistoryTable';

export const ImmunizationOrderCreateEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id: appointmentId, orderId } = useParams();
  const { oystehrZambda } = useApiClients();

  const {
    resources: { encounter, patient },
  } = useAppointmentData(appointmentId);

  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const [isOrderSaved, setIsOrderSaved] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutateAsync: createUpdateOrder, isPending: isOrderSaving } = useCreateUpdateImmunizationOrder();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder();

  // Quick picks state
  const { quickPicks: mergedQuickPicks } = useMergedImmunizationQuickPicks();
  const [quickPickDialogOpen, setQuickPickDialogOpen] = useState(false);
  const [quickPickName, setQuickPickName] = useState('');
  const [existingQuickPicks, setExistingQuickPicks] = useState<ImmunizationQuickPickData[]>([]);
  const [quickPickSaving, setQuickPickSaving] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<ImmunizationQuickPickData | null>(null);

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
      enqueueSnackbar('An error occurred while deleting the immunization order. Please try again.', {
        variant: 'error',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const { data: ordersResponse, isLoading: isOrderLoading } = useGetImmunizationOrders({
    orderId: orderId,
  });

  const methods = useForm();

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

  // Quick pick handlers
  const onQuickPickSelect = (quickPick: ImmunizationQuickPickData): void => {
    const currentValues = methods.getValues();
    methods.reset({
      ...currentValues,
      details: {
        ...currentValues.details,
        ...(quickPick.vaccine && { medication: quickPick.vaccine }),
        ...(quickPick.dose && { dose: quickPick.dose }),
        ...(quickPick.units && { units: quickPick.units }),
        ...(quickPick.route && { route: quickPick.route }),
        ...(quickPick.location && { location: quickPick.location }),
        ...(quickPick.associatedDx && { associatedDx: quickPick.associatedDx }),
        ...(quickPick.manufacturer && { manufacturer: quickPick.manufacturer }),
        ...(quickPick.instructions && { instructions: quickPick.instructions }),
      },
      administrationDetails: {
        ...currentValues.administrationDetails,
        ...(quickPick.cvx && { cvx: quickPick.cvx }),
        ...(quickPick.mvx && { mvx: quickPick.mvx }),
        ...(quickPick.cpt && { cpt: quickPick.cpt }),
        ...(quickPick.ndc && { ndc: quickPick.ndc }),
        ...(quickPick.lot && { lot: quickPick.lot }),
        ...(quickPick.expDate && { expDate: quickPick.expDate }),
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
    setQuickPickName('');
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
      associatedDx: values.details?.associatedDx,
      manufacturer: values.details?.manufacturer,
      instructions: values.details?.instructions,
      cvx: values.administrationDetails?.cvx,
      mvx: values.administrationDetails?.mvx,
      cpt: values.administrationDetails?.cpt,
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
    if (!oystehrZambda) {
      throw new Error('oystehrZambda was null');
    }

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
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
    } finally {
      setQuickPickSaving(false);
    }
  };

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
