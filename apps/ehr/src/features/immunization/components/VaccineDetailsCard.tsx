import { Box, Grid, Paper, Stack, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { SingleCptCodeInput } from 'src/components/input/SingleCptInput';
import { TextInput } from 'src/components/input/TextInput';
import { TimeInput } from 'src/components/input/TimeInput';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { useAdministerImmunizationOrder, useGetVaccines } from 'src/features/css-module/hooks/useImmunization';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { ROUTE_OPTIONS, UNIT_OPTIONS } from 'src/shared/utils';
import { useAppointmentData } from 'src/telemed';
import { EMERGENCY_CONTACT_RELATIONSHIPS, ImmunizationOrder, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
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
  const methods = useForm({
    defaultValues: {
      ...order,
      details: {
        ...order.details,
        medicationId: order?.details?.medication?.id,
        orderedProviderId: order?.details?.orderedProvider?.id,
      },
      administrationDetails: {
        ...order.administrationDetails,
        administeredDateTime: DateTime.now().toISO(),
      },
      visGiven: order.administrationDetails?.visGivenDate != null,
      otherReason: '',
    },
  });
  const theme = useTheme();
  const [showAdministrationConfirmationDialog, setShowAdministrationConfirmationDialog] = useState<boolean>(false);
  const administrationTypeRef = useRef<AdministrationType>(ADMINISTERED);

  const { id: appointmentId } = useParams();
  const { mappedData } = useAppointmentData(appointmentId);
  const { data: vaccines } = useGetVaccines();

  const { mutateAsync: administerOrder } = useAdministerImmunizationOrder();

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
                  Administering vaccine
                </Typography>
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administrationDetails.lot" label="LOT number" validate={requiredForAdministration} />
              </Grid>
              <Grid xs={3} item>
                <DateInput
                  name="administrationDetails.expDate"
                  label="Exp. Date"
                  validate={requiredForAdministration}
                />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administrationDetails.mvx" label="MVX code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administrationDetails.cvx" label="CVX code" required />
              </Grid>
              <Grid xs={3} item>
                <SingleCptCodeInput name="administrationDetails.cpt" label="CPT code" />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administrationDetails.ndc" label="NDC code" required />
              </Grid>
              <Grid xs={3} item>
                <DateInput
                  name="administrationDetails.administeredDateTime"
                  label="Administered date"
                  validate={requiredForAdministration}
                />
              </Grid>
              <Grid xs={3} item>
                <TimeInput
                  name="administrationDetails.administeredDateTime"
                  label="Administered time"
                  validate={requiredForAdministration}
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
                    validate={requiredForAdministration}
                  />
                </Box>
              </Grid>
              <Grid xs={6} item>
                <DateInput
                  name="administrationDetails.visGivenDate"
                  label="VIS given date"
                  validate={requiredForAdministration}
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
                  options={RELATIONSHIP_OPTIONS}
                  validate={requiredForAdministration}
                />
              </Grid>
              <Grid xs={4} item>
                <TextInput
                  name="administrationDetails.emergencyContact.fullName"
                  label="Full name"
                  validate={requiredForAdministration}
                />
              </Grid>
              <Grid xs={4} item>
                <PhoneInput
                  name="administrationDetails.emergencyContact.mobile"
                  label="Mobile"
                  validate={requiredForAdministration}
                />
              </Grid>
              <Grid xs={12} item>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <OrderStatusChip status={order.status} />
                  <Stack direction="row">
                    <ButtonRounded
                      variant="outlined"
                      color="primary"
                      size="large"
                      onClick={async () => onAdministrationActionClick(NOT_ADMINISTERED)}
                    >
                      Not Administered
                    </ButtonRounded>
                    <ButtonRounded
                      variant="outlined"
                      color="primary"
                      size="large"
                      onClick={async () => onAdministrationActionClick(PARTLY_ADMINISTERED)}
                    >
                      Partly Administered
                    </ButtonRounded>
                    <ButtonRounded
                      variant="contained"
                      color="primary"
                      size="large"
                      onClick={async () => onAdministrationActionClick(ADMINISTERED)}
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
          medicationName={vaccines?.find((vaccine) => vaccine.id === methods.getValues('details.medicationId'))?.name}
          dose={methods.getValues('details.dose')}
          unit={UNIT_OPTIONS.find((unit) => unit.value === methods.getValues('details.units'))?.label}
          route={ROUTE_OPTIONS.find((route) => route.value === methods.getValues('details.route'))?.label}
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
