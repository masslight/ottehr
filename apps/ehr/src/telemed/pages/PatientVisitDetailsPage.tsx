import { Appointment, FhirResource, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { Box, Grid } from '@mui/material';
import { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { getInsurancePlanById } from 'utils';
import { LoadingScreen } from '../../components/LoadingScreen';
import {
  AboutPatientContainer,
  BreadCrumbs,
  CompletedFormsContainer,
  ContactContainer,
  InsuranceCardAndPhotoContainer,
  InsuranceContainer,
  PatientDetailsContainer,
  ResponsibleInformationContainer,
  SecondaryInsuranceContainer,
  TitleRow,
} from '../features/patient-visit-details/components';
import { useResetAppointmentStore } from '../hooks';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';
import { useAppointmentStore, useGetAppointment } from '../state';

export const PatientVisitDetails: FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const appointmentId = queryParams.get('appointment') || undefined;

  useResetAppointmentStore();

  const { oystehr } = useApiClients();
  const { isFetching } = useGetAppointment(
    {
      appointmentId,
    },
    async (data) => {
      const appointment = data?.find(
        (resource: FhirResource) => resource.resourceType === 'Appointment'
      ) as unknown as Appointment;
      const patient = data?.find((resource: FhirResource) => resource.resourceType === 'Patient') as unknown as Patient;
      const location = data?.find(
        (resource: FhirResource) => resource.resourceType === 'Location'
      ) as unknown as Location;
      const questionnaireResponse = data?.find(
        (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse'
      ) as unknown as QuestionnaireResponse;

      // Update insurance in questionnaireResponse accordingly insurance plan id stored in questionnaireResponse
      if (questionnaireResponse?.item) {
        for (const item of questionnaireResponse.item) {
          if (
            (item.linkId === 'insurance-carrier' || item.linkId === 'insurance-carrier-2') &&
            item.answer?.[0]?.valueString
          ) {
            const insuranceId = item?.answer?.[0]?.valueString;
            try {
              if (oystehr) {
                const insurancePlan = await getInsurancePlanById(insuranceId, oystehr);
                item.answer[0].valueString = insurancePlan.name || '-';
              }
            } catch (error) {
              console.error(`Error fetching InsurancePlan with id ${insuranceId}:`, error);
            }
          }
        }
      }

      useAppointmentStore.setState({
        appointment,
        patient,
        location,
        questionnaireResponse,
      });
    }
  );

  return (
    <PageContainer tabTitle={'Patient Visit Details'}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isFetching ? (
          <LoadingScreen />
        ) : (
          <Box sx={{ maxWidth: '1200px' }}>
            <BreadCrumbs />
            <TitleRow />
            <InsuranceCardAndPhotoContainer />
            <Grid container direction="row">
              <Grid item xs={6} paddingRight={2}>
                <AboutPatientContainer />
                <ContactContainer />
                <PatientDetailsContainer />
              </Grid>
              <Grid item xs={6} paddingLeft={2}>
                <InsuranceContainer />
                <SecondaryInsuranceContainer />
                <ResponsibleInformationContainer />
                <CompletedFormsContainer />
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};
