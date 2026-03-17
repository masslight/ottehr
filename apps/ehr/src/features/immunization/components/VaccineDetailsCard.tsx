import { LoadingButton } from '@mui/lab';
import { Box, Grid, Paper, Stack, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { CustomDialog } from 'src/components/dialogs';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { SingleCptCodeInput } from 'src/components/input/SingleCptInput';
import { TextInput } from 'src/components/input/TextInput';
import { TimeInput } from 'src/components/input/TimeInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import {
  useAdministerImmunizationOrder,
  useCancelImmunizationOrder,
} from 'src/features/visits/in-person/hooks/useImmunization';
import { getImmunizationMARUrl } from 'src/features/visits/in-person/routing/helpers';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { ROUTE_OPTIONS } from 'src/shared/utils';
import { EMERGENCY_CONTACT_RELATIONSHIPS, ImmunizationOrder, REQUIRED_FIELD_ERROR_MESSAGE, UNIT_OPTIONS } from 'utils';
import { ADMINISTERED, AdministrationType, NOT_ADMINISTERED, PARTLY_ADMINISTERED } from '../common';
import { AdministrationConfirmationDialog } from './AdministrationConfirmationDialog';
import { ImmunizationNotes } from './ImmunizationNotes';
import { OrderDetailsSection } from './OrderDetailsSection';
import { OrderHistoryTable } from './OrderHistoryTable';
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
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const administrationTypeRef = useRef<AdministrationType>(ADMINISTERED);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { id: appointmentId } = useParams();
  const {
    mappedData,
    resources: { patient },
  } = useAppointmentData(appointmentId);

  const { mutateAsync: administerOrder } = useAdministerImmunizationOrder();
  const { mutateAsync: cancelOrder, isPending: isDeleting } = useCancelImmunizationOrder();

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
              <Grid xs={3} item>
                <SingleCptCodeInput
                  name="administrationDetails.cpt"
                  label="CPT code"
                  dataTestId={dataTestIds.vaccineDetailsPage.cptCode}
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
                  getOptionLabel={(option) => RELATIONSHIP_OPTIONS.find((opt) => opt.value === option)?.label ?? option}
                  required
                  validate={requiredForAdministration}
                  dataTestId={dataTestIds.vaccineDetailsPage.relationship}
                />
              </Grid>
              <Grid xs={4} item>
                <TextInput
                  name="administrationDetails.emergencyContact.fullName"
                  label="Full name"
                  required
                  validate={requiredForAdministration}
                  dataTestId={dataTestIds.vaccineDetailsPage.fullName}
                />
              </Grid>
              <Grid xs={4} item>
                <PhoneInput
                  name="administrationDetails.emergencyContact.mobile"
                  label="Mobile"
                  required
                  validate={requiredForAdministration}
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
          <AccordionCard
            label="Immunization History"
            collapsed={isImmunizationHistoryCollapsed}
            onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
            withBorder={false}
          >
            <OrderHistoryTable showActions={false} administeredOnly immunizationInput={{ patientId: patient?.id }} />
          </AccordionCard>
          <ImmunizationNotes />
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
      </form>
    </FormProvider>
  );
};
