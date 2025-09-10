import { LoadingButton } from '@mui/lab';
import { Grid, Paper, Stack } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { WarningBlock } from 'src/features/css-module/components/WarningBlock';
import { getImmunizationMARUrl, getImmunizationOrderEditUrl } from 'src/features/css-module/routing/helpers';
import { cleanupProperties } from 'src/helpers/misc.helper';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { AccordionCard, useAppointmentData } from 'src/telemed';
import { RoleType } from 'utils';
import { PageHeader } from '../../css-module/components/medication-administration/PageHeader';
import { useCreateUpdateImmunizationOrder, useGetImmunizationOrders } from '../../css-module/hooks/useImmunization';
import { OrderDetailsSection } from '../components/OrderDetailsSection';
import { OrderHistoryTable } from '../components/OrderHistoryTable';

export const ImmunizationOrderCreateEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id: appointmentId, orderId } = useParams();

  const {
    resources: { encounter },
  } = useAppointmentData(appointmentId);

  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const { mutateAsync: createUpdateOrder, isPending: isOrderSaving } = useCreateUpdateImmunizationOrder();

  const onSubmit = async (data: any): Promise<void> => {
    const response = await createUpdateOrder({
      encounterId: encounter?.id ?? '',
      orderId: orderId,
      ...(await cleanupProperties(data)),
    });
    navigate(getImmunizationOrderEditUrl(appointmentId!, response.orderId));
  };

  const { data: ordersResponse, isLoading: isOrderLoading } = useGetImmunizationOrders({
    orderId: orderId,
  });

  const methods = useForm();

  useEffect(() => {
    const order = ordersResponse?.orders?.find((order) => order.id === orderId);
    if (order) {
      methods.reset({
        ...order,
        details: {
          ...order.details,
          medicationId: order?.details?.medication?.id,
          orderedProviderId: order?.details?.orderedProvider?.id,
        },
      });
    }
  }, [methods, ordersResponse, orderId]);

  const currentUser = useEvolveUser();
  const currentUserProviderId = currentUser?.profile?.split('/')[1];
  const currentUserHasProviderRole = currentUser?.hasRole?.([RoleType.Provider]);
  const defaultProviderId = currentUserHasProviderRole ? currentUserProviderId : undefined;

  useEffect(() => {
    if (!orderId) {
      methods.reset({
        details: {
          orderedProviderId: defaultProviderId,
        },
      });
    }
  }, [methods, defaultProviderId, orderId]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <BaseBreadcrumbs
            sectionName={orderId ? 'Edit Vaccine Order' : 'Order Vaccine'}
            baseCrumb={{ label: 'Immunization', path: getImmunizationMARUrl(appointmentId ?? '') }}
          />
          <PageHeader title={orderId ? 'Edit Vaccine Order' : 'Order Vaccine'} variant="h3" component="h1" />
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
                  <ButtonRounded
                    variant="outlined"
                    color="primary"
                    size="large"
                    onClick={() => navigate(getImmunizationMARUrl(appointmentId!))}
                  >
                    Cancel
                  </ButtonRounded>
                  <LoadingButton
                    type="submit"
                    disabled={isOrderLoading}
                    loading={isOrderSaving}
                    variant="contained"
                    color="primary"
                    size="large"
                    sx={{
                      borderRadius: '20px',
                      textTransform: 'none',
                    }}
                  >
                    {orderId ? 'Save changes' : 'Order Vaccine'}
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
            <OrderHistoryTable showActions={false} administeredOnly />
          </AccordionCard>
        </Stack>
      </form>
    </FormProvider>
  );
};
