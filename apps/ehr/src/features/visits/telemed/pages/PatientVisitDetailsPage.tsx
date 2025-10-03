import { Box, Grid } from '@mui/material';
import { FC, useEffect, useRef } from 'react';
import { LoadingScreen } from 'src/components/LoadingScreen';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { getInsuranceOrgById } from 'utils';
import { useResetAppointmentStore } from '../../shared/hooks/useResetAppointmentStore';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';
import { AboutPatientContainer } from '../components/patient-visit-details/AboutPatientContainer';
import { BreadCrumbs } from '../components/patient-visit-details/BreadCrumbs';
import { CompletedFormsContainer } from '../components/patient-visit-details/CompletedFormsContainer';
import { ContactContainer } from '../components/patient-visit-details/ContactContainer';
import { InsuranceCardAndPhotoContainer } from '../components/patient-visit-details/InsuranceCardAndPhotoContainer';
import { InsuranceContainer } from '../components/patient-visit-details/InsuranceContainer';
import { PatientDetailsContainer } from '../components/patient-visit-details/PatientDetailsContainer';
import { ResponsibleInformationContainer } from '../components/patient-visit-details/ResponsibleInformationContainer';
import { SecondaryInsuranceContainer } from '../components/patient-visit-details/SecondaryInsuranceContainer';
import { TitleRow } from '../components/patient-visit-details/TitleRow';

export const PatientVisitDetails: FC = () => {
  useResetAppointmentStore();
  const { oystehr } = useApiClients();
  const { isFetching, questionnaireResponse, appointmentSetState } = useAppointmentData();
  const didInsuranceUpdateRef = useRef(false);

  useEffect(() => {
    if (!questionnaireResponse || !oystehr || didInsuranceUpdateRef.current) return;

    // todo: check - previous version used anti pattern "mutation state", need to check current implementation is correct
    // todo: also it looks this should be a part of appointment fetch logic
    const updateInsurance = async (): Promise<void> => {
      const updatedResponse = { ...questionnaireResponse };

      if (updatedResponse.item) {
        updatedResponse.item = await Promise.all(
          updatedResponse.item.map(async (item) => {
            if (
              (item.linkId === 'insurance-carrier' || item.linkId === 'insurance-carrier-2') &&
              item.answer?.[0]?.valueString
            ) {
              const insuranceId = item.answer[0].valueString;
              try {
                const insuranceOrg = await getInsuranceOrgById(insuranceId, oystehr);
                return {
                  ...item,
                  answer: [
                    {
                      ...item.answer[0],
                      valueString: insuranceOrg.name || '-',
                    },
                  ],
                };
              } catch (error) {
                console.error(`Error fetching Organization with id ${insuranceId}:`, error);
                return item;
              }
            }
            return item;
          })
        );
      }

      appointmentSetState({
        questionnaireResponse: updatedResponse,
      });

      didInsuranceUpdateRef.current = true;
    };

    void updateInsurance();
  }, [appointmentSetState, oystehr, questionnaireResponse]);

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
