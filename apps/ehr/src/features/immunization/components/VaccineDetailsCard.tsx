import { Box, Grid, Paper, Stack, Typography, useTheme } from '@mui/material';
import React, { useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { TimeInput } from 'src/components/input/TimeInput';
import { CSSModal } from 'src/features/css-module/components/CSSModal';
import {
  ReasonListCodes,
  reasonListValues,
} from 'src/features/css-module/components/medication-administration/medicationTypes';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { useAppointment } from 'src/features/css-module/hooks/useAppointment';
import { useAdministerImmunizationOrder } from 'src/features/css-module/hooks/useImmunization';
import { cleanupProperties } from 'src/helpers/misc.helper';
import { ROUTE_OPTIONS, UNIT_OPTIONS } from 'src/shared/utils';
import { useGetMedicationList } from 'src/telemed';
import { EMERGENCY_CONTACT_RELATIONSHIPS, ImmunizationOrder, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { OrderDetailsSection } from './OrderDetailsSection';

interface Props {
  order: ImmunizationOrder;
}

const RELATIONSHIP_OPTIONS = Object.entries(EMERGENCY_CONTACT_RELATIONSHIPS).map(([_, value]) => ({
  value: value.code,
  label: value.display,
}));

interface AdministrationType {
  type: string;
  label: string;
}

const ADMINISTERED: AdministrationType = {
  type: 'administered',
  label: 'Administered',
};

const NOT_ADMINISTERED: AdministrationType = {
  type: 'administered-not',
  label: 'Not Administered',
};

const PARTLY_ADMINISTERED: AdministrationType = {
  type: 'administered-partly',
  label: 'Partly Administered',
};

export const VaccineDetailsCard: React.FC<Props> = ({ order }) => {
  const methods = useForm({
    defaultValues: {
      ...order,
      details: {
        ...order.details,
        medicationId: order?.details?.medication?.id,
        orderedProviderId: order?.details?.orderedProvider?.id,
      },
      visGiven: order.administrationDetails?.visGivenDate != null,
      otherReason: '',
    },
  });
  const theme = useTheme();
  const [showAdministrationReasonDialog, setShowAdministrationReasonDialog] = useState<boolean>(false);
  const administrationTypeRef = useRef<AdministrationType>(ADMINISTERED);

  const { id: appointmentId } = useParams();
  const { mappedData } = useAppointment(appointmentId);
  const { data: medications } = useGetMedicationList();

  const { mutateAsync: administerOrder } = useAdministerImmunizationOrder();

  const onSubmit = async (data: any): Promise<void> => {
    await administerOrder({
      orderId: order.id,
      type: 'administered',
      ...(await cleanupProperties(data)),
    });
  };

  const onAdministrationActionClick = async (administrationType: AdministrationType): Promise<void> => {
    administrationTypeRef.current = administrationType;
    if (await methods.trigger()) {
      setShowAdministrationReasonDialog(true);
    }
  };

  const requiredForAdministration = (value: string | undefined): boolean | string => {
    if (administrationTypeRef.current !== NOT_ADMINISTERED && (!value || value.length === 0)) {
      return REQUIRED_FIELD_ERROR_MESSAGE;
    }
    return true;
  };

  const reason = methods.watch('reason');
  const otherReason = methods.watch('otherReason');

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
                <TextInput name="administrationDetails.lot" label="LOT number" required />
              </Grid>
              <Grid xs={3} item>
                <DateInput name="administrationDetails.expDate" label="Exp. Date" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administrationDetails.mvx" label="MVX code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administrationDetails.cvx" label="CVX code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administrationDetails.cpt" label="CPT code" />
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
                    label="VIS was given to the patient*"
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
                  variant="h4"
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
                <TextInput
                  name="administrationDetails.emergencyContact.mobile"
                  label="Mobile"
                  validate={requiredForAdministration}
                />
              </Grid>
              <Grid xs={12} item>
                <Stack direction="row" justifyContent="end" alignItems="center">
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
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={async () => onAdministrationActionClick(ADMINISTERED)}
                  >
                    Administered
                  </ButtonRounded>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
        <CSSModal
          color="primary.main"
          icon={null}
          showEntityPreview={false}
          open={showAdministrationReasonDialog}
          handleClose={() => {
            setShowAdministrationReasonDialog(false);
          }}
          handleConfirm={() => methods.handleSubmit(onSubmit)()}
          disabled={!reason || (reason === ReasonListCodes.OTHER && !otherReason)}
          description={''}
          title={'Order ' + administrationTypeRef.current.label}
          confirmText={'Mark as ' + administrationTypeRef.current.label}
          closeButtonText="Cancel"
          ContentComponent={() => {
            return (
              <Box display="flex" flexDirection="column" gap={1}>
                <Typography>
                  <strong>Patient:</strong> {mappedData.patientName}
                </Typography>
                <Typography>
                  <strong>Vaccine:</strong> {medications?.[methods.getValues('details.medicationId')]} /{' '}
                  {methods.getValues('details.dose')}
                  {UNIT_OPTIONS.find((unit) => unit.value === methods.getValues('details.units'))?.label} /{' '}
                  {ROUTE_OPTIONS.find((route) => route.value === methods.getValues('details.route'))?.label}
                </Typography>
                <Typography>
                  Please confirm that you want to mark this immunization order as{' '}
                  {<strong>{administrationTypeRef.current.label}</strong>}
                  {administrationTypeRef.current.type !== 'administered' ? ' and select the reason.' : '.'}
                </Typography>
                {administrationTypeRef.current.type !== 'administered' ? (
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <SelectInput
                      name="reason"
                      label="Reason"
                      options={Object.entries(reasonListValues).map(([value, label]) => {
                        return {
                          value,
                          label,
                        };
                      })}
                      required
                    />
                    {reason === ReasonListCodes.OTHER && (
                      <TextInput name="otherReason" label="Specify reason" required />
                    )}
                  </Stack>
                ) : null}
              </Box>
            ) as JSX.Element;
          }}
        />
      </form>
    </FormProvider>
  );
};
