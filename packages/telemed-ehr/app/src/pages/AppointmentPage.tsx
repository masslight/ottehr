import { Box, Container } from '@mui/material';
import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AppointmentFooter,
  AppointmentHeader,
  AppointmentSidePanel,
  AppointmentTabs,
  AppointmentTabsHeader,
} from '../telemed/features/appointment';
import { PATIENT_PHOTO_CODE, getQuestionnaireResponseByLinkId } from 'ehr-utils';
import {
  useAppointmentStore,
  useExamObservationsStore,
  EXAM_OBSERVATIONS_INITIAL,
  useGetAppointmentInformation,
  useIsReadOnly,
} from '../telemed';
import { useExamCardsStore, EXAM_CARDS_INITIAL } from '../telemed/state/appointment/exam-cards.store';
import {
  FhirResource,
  Location,
  QuestionnaireResponse,
  Appointment,
  Patient,
  Encounter,
  DocumentReference,
} from 'fhir/r4';

export const AppointmentPage: FC = () => {
  const { id } = useParams();
  useIsReadOnly();

  const navigate = useNavigate();

  const { isFetching } = useGetAppointmentInformation(
    {
      appointmentId: id,
    },
    (data) => {
      const questionnaireResponse = data?.find(
        (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse',
      ) as unknown as QuestionnaireResponse;
      useAppointmentStore.setState({
        appointment: data?.find(
          (resource: FhirResource) => resource.resourceType === 'Appointment',
        ) as unknown as Appointment,
        patient: data?.find((resource: FhirResource) => resource.resourceType === 'Patient') as unknown as Patient,
        location: data?.find((resource: FhirResource) => resource.resourceType === 'Location') as unknown as Location,
        encounter: data?.find(
          (resource: FhirResource) => resource.resourceType === 'Encounter',
        ) as unknown as Encounter,
        questionnaireResponse,
        patientPhotoUrls:
          (data
            ?.filter(
              (resource: FhirResource) =>
                resource.resourceType === 'DocumentReference' &&
                resource.status === 'current' &&
                resource.type?.coding?.[0].code === PATIENT_PHOTO_CODE,
            )
            .flatMap((docRef: FhirResource) => (docRef as DocumentReference).content.map((cnt) => cnt.attachment.url))
            .filter(Boolean) as string[]) || [],
      });
    },
  );

  useEffect(() => {
    useAppointmentStore.setState({
      appointment: undefined,
      patient: undefined,
      location: undefined,
      encounter: {} as Encounter,
      questionnaireResponse: undefined,
      patientPhotoUrls: [],
      chartData: undefined,
      currentTab: 'hpi',
    });
    useExamObservationsStore.setState(EXAM_OBSERVATIONS_INITIAL);
    useExamCardsStore.setState(EXAM_CARDS_INITIAL);
  }, []);

  useEffect(() => {
    useAppointmentStore.setState({ isAppointmentLoading: isFetching });
  }, [isFetching]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <AppointmentHeader onClose={() => navigate('/')} />

      <Box sx={{ display: 'flex', flex: 1, width: '100%' }}>
        <AppointmentSidePanel />

        <Container maxWidth="xl" sx={{ my: 3 }}>
          <AppointmentTabs />
        </Container>
      </Box>
    </Box>
  );
};
