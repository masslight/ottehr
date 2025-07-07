import { Box, Grid } from '@mui/material';
import { Appointment, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { getInsuranceOrgById, isLocationVirtual } from 'utils';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';
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
import { useAppointmentStore, useGetAppointment, VisitResources } from '../state';

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
        (resource: VisitResources) => resource.resourceType === 'Appointment'
      ) as Appointment;
      const patient = data?.find((resource: VisitResources) => resource.resourceType === 'Patient') as Patient;
      const location = (
        data?.filter((resource: VisitResources) => resource.resourceType === 'Location') as Location[]
      ).find((location) => !isLocationVirtual(location));
      const locationVirtual = (
        data?.filter((resource: VisitResources) => resource.resourceType === 'Location') as Location[]
      ).find((location) => isLocationVirtual(location));
      const questionnaireResponse = data?.find(
        (resource: VisitResources) => resource.resourceType === 'QuestionnaireResponse'
      ) as QuestionnaireResponse;

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
                const insuranceOrg = await getInsuranceOrgById(insuranceId, oystehr);
                item.answer[0].valueString = insuranceOrg.name || '-';
              }
            } catch (error) {
              console.error(`Error fetching Organization with id ${insuranceId}:`, error);
            }
          }
        }
      }

      useAppointmentStore.setState({
        appointment,
        patient,
        location,
        locationVirtual,
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
