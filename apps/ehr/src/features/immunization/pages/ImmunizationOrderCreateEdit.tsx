import { LoadingButton } from '@mui/lab';
import { Grid, Paper, Stack } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { WarningBlock } from 'src/features/visits/in-person/components/WarningBlock';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { cleanupProperties } from 'src/helpers/misc.helper';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { RoleType } from 'utils';
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

  const {
    resources: { encounter, patient },
  } = useAppointmentData(appointmentId);

  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const [isOrderSaved, setIsOrderSaved] = useState(false);
  const { mutateAsync: createUpdateOrder, isPending: isOrderSaving } = useCreateUpdateImmunizationOrder();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder();

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

  const currentUser = useEvolveUser();
  const currentUserProviderId = currentUser?.profile?.split('/')[1];
  const currentUserHasProviderRole = currentUser?.hasRole?.([RoleType.Provider]);
  const defaultProviderId = currentUserHasProviderRole ? currentUserProviderId : undefined;

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
                    <ButtonRounded
                      variant="outlined"
                      color="primary"
                      size="large"
                      onClick={() => navigate(getImmunizationMARUrl(appointmentId!))}
                    >
                      Cancel
                    </ButtonRounded>
                    {orderId && (
                      <LoadingButton
                        variant="outlined"
                        color="warning"
                        size="large"
                        loading={isDeleting}
                        onClick={handleDeleteOrder}
                        sx={{
                          borderRadius: '20px',
                          textTransform: 'none',
                        }}
                      >
                        Delete Order
                      </LoadingButton>
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
            label="Pre-visit immunization history"
            collapsed={isImmunizationHistoryCollapsed}
            onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
            withBorder={false}
          >
            <OrderHistoryTable showActions={false} administeredOnly immunizationInput={{ patientId: patient?.id }} />
          </AccordionCard>
        </Stack>
      </form>
    </FormProvider>
  );
};
