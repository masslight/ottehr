// cSpell:ignore tokenful
import { CircularProgress } from '@mui/material';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useQuery } from 'react-query';
import { generatePath, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { APIError, getPatientInfoFullName, isApiError, PatientInfo } from 'utils';
import ottehrApi from '../api/ottehrApi';
import { intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog } from '../components/ErrorDialog';
import PatientList from '../features/patients/components/selectable-list';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';

const MyPatients = (): JSX.Element => {
  const navigate = useNavigate();
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const [errorForAlert, setErrorForAlert] = useState<any | undefined>(undefined);

  const params = useParams();
  const isRoot = !params.patientId;

  const {
    data: patientsData,
    isLoading: patientsLoading,
    isFetching: patientsFetching,
    isRefetching: patientsRefetching,
  } = useQuery(
    ['get-patients', { zambdaClient: tokenfulZambdaClient }],
    () => (tokenfulZambdaClient ? ottehrApi.getPatients(tokenfulZambdaClient) : null),
    {
      onSuccess: (response) => {
        console.log('get patients response:', response);
      },
      onError: (error) => {
        console.log('get patients error:', error);
        setErrorForAlert(error);
      },
      enabled: Boolean(tokenfulZambdaClient),
    }
  );

  const patientsLoadingInSomeWay = patientsLoading || patientsFetching || patientsRefetching;

  const { selectedPatient, patientFullName, formattedPatientBirthDay } = useMemo(() => {
    const selectedPatient = patientsData?.patients.find((patient) => patient.id === params.patientId);
    const patientFullName = selectedPatient ? getPatientInfoFullName(selectedPatient) : 'Unknown Patient';
    let formattedPatientBirthDay = '';
    if (selectedPatient?.dateOfBirth) {
      const bday = DateTime.fromISO(selectedPatient.dateOfBirth);
      bday.setLocale('en-US');
      if (bday.isValid) {
        const dateString = bday.toLocaleString({ year: 'numeric', month: 'long', day: 'numeric' });
        formattedPatientBirthDay = `Birthday: ${dateString}`;
      }
    }

    return {
      selectedPatient,
      patientFullName,
      formattedPatientBirthDay,
    };
  }, [patientsData, params.patientId]);

  const onBack = (): void => {
    navigate(`/home`);
  };

  const onSubmit = async (data: FieldValues): Promise<void> => {
    const { patientID } = data;
    if (!patientID) {
      return;
    }

    const destination = generatePath(intakeFlowPageRoute.PastVisits.path, {
      patientId: patientID,
    });
    navigate(destination);
  };

  const bottomMessage = patientsData?.patients.length === 0 ? 'No patients are found for this user.' : undefined;

  if (patientsLoadingInSomeWay) {
    return (
      <PageContainer title="Loading patients...">
        <CircularProgress />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={selectedPatient ? patientFullName : 'My patients'} subtext={formattedPatientBirthDay}>
      {isRoot && (
        <PatientList
          patients={patientsData?.patients ?? []}
          subtitle="Choose a patient to see their past visits"
          pastVisits={true}
          bottomMessage={bottomMessage}
          onSubmit={onSubmit}
          onBack={onBack}
        />
      )}
      {!isRoot && (
        <Outlet
          context={{
            patients: patientsData?.patients ?? [],
            loading: patientsLoadingInSomeWay,
            selectedPatient,
            patientFullName,
            formattedPatientBirthDay,
          }}
        />
      )}
      <ErrorDialog
        open={errorForAlert != undefined}
        title="Error fetching patients"
        description={isApiError(errorForAlert) ? (errorForAlert as APIError).message : 'An unknown error occurred'}
        closeButtonText={'OK'}
        handleClose={() => {
          setErrorForAlert(undefined);
        }}
      />
    </PageContainer>
  );
};

export interface MyPatientsContext {
  patients: PatientInfo[];
  loading: boolean;
  selectedPatient: PatientInfo | undefined;
  patientFullName: string | undefined;
  formattedPatientBirthDay: string | undefined;
}

export const useMyPatientsContext = (): MyPatientsContext => {
  const outletContext = useOutletContext<MyPatientsContext>();
  return {
    ...outletContext,
  };
};

export default MyPatients;
