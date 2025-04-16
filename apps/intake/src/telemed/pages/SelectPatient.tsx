import { useEffect, useMemo } from 'react';
import { Box, CircularProgress, Skeleton } from '@mui/material';
import { DateTime } from 'luxon';
import { FieldValues } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { BoldPurpleInputLabel, PageForm } from 'ui-components';
import { getSelectors, getPatientInfoFullNameUsingChosen, sortFullNames } from 'utils';
import { intakeFlowPageRoute } from '../../App';
import { otherColors } from '../../IntakeThemeProvider';
import { useAppointmentStore } from '../features/appointments';
import { CustomContainer, initialLocationState, useIntakeCommonStore } from '../features/common';
import { useFilesStore } from '../features/files';
import { usePatientInfoStore } from '../features/patient-info';
import { useGetPatients, usePatientsStore } from '../features/patients';
import { DIFFERENT_FAMILY_MEMBER_DATA, useZapEHRAPIClient } from '../utils';

const FORM_PATIENT_ID_ELEMENT_BASE = {
  name: 'patientId',
  label: 'Select patient',
  defaultValue: '',
  required: true,
};

const SelectPatient = (): JSX.Element => {
  const { patientInfo: currentPatientInfo, setNewPatient } = usePatientInfoStore.getState();
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const flow = urlParams.get('flow');
  const patientsStore = getSelectors(usePatientsStore, ['patients']);

  const { refetch, isFetching } = useGetPatients(apiClient, (data) => {
    usePatientsStore.setState({ patients: data?.patients || [] });
    if (location.state?.patientId) {
      onSubmit({ patientId: location.state.patientId });
    }
  });

  const sortedPatients = useMemo(() => {
    const { patients } = patientsStore;
    return patients ? [...patients].sort(sortFullNames) : [];
  }, [patientsStore]);

  const hasNoPatients = flow === 'pastVisits' && sortedPatients.length === 0;

  useEffect(() => {
    if (apiClient) {
      void refetch();
    }
  }, [refetch, apiClient]);

  const onSubmit = (data: FieldValues): void => {
    const selectedPatient = patientsStore.patients?.find((patient) => patient.id === data.patientId);

    if (selectedPatient) {
      usePatientInfoStore.setState(() => ({
        patientInfo: {
          ...selectedPatient,
          id: selectedPatient.id || undefined,
          newPatient: false,
          dateOfBirth: DateTime.fromISO(selectedPatient.dateOfBirth || '').toString(),
          reasonForVisit: selectedPatient?.reasonForVisit,
        },
        pendingPatientInfoUpdates: undefined,
      }));
    } else {
      setNewPatient();
    }

    if (flow === 'requestVisit') {
      useAppointmentStore.setState({ appointmentDate: undefined, appointmentID: undefined });
      useFilesStore.setState({ fileURLs: undefined, fileUploads: {} });
      useIntakeCommonStore.setState({ selectedLocationState: initialLocationState.selectedLocationState });
      navigate(`${intakeFlowPageRoute.RequestVirtualVisit.path}?flow=${flow}`);
    } else if (flow === 'continueVisitRequest') {
      useFilesStore.setState({ fileURLs: undefined, fileUploads: {} });
      useIntakeCommonStore.setState({ selectedLocationState: initialLocationState.selectedLocationState });
      navigate(`${intakeFlowPageRoute.RequestVirtualVisit.path}?flow=${flow}`);
    } else if (flow === 'pastVisits') {
      navigate(intakeFlowPageRoute.PastVisits.path);
    }
  };

  const onBack = (): void => {
    navigate(intakeFlowPageRoute.Homepage.path);
  };

  if (location.state?.patientId) {
    return (
      <CustomContainer title="Loading patient" description="">
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </CustomContainer>
    );
  }

  return (
    <CustomContainer title="Select patient" description="">
      {isFetching ? (
        <Box sx={{ pt: 2 }}>
          <BoldPurpleInputLabel shrink>Select patient *</BoldPurpleInputLabel>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Skeleton
                  key={i}
                  variant="rounded"
                  height={80}
                  sx={{
                    borderRadius: 2,
                    backgroundColor: otherColors.coachingVisit,
                  }}
                />
              ))}
          </Box>
        </Box>
      ) : (
        <PageForm
          formElements={[
            {
              type: 'Radio',
              ...FORM_PATIENT_ID_ELEMENT_BASE,
              defaultValue: currentPatientInfo.id || FORM_PATIENT_ID_ELEMENT_BASE.defaultValue || 'new-patient',
              radioOptions: hasNoPatients
                ? []
                : sortedPatients
                    .map((patient) => {
                      if (!patient.id) {
                        throw new Error('Patient id is not defined');
                      }
                      return {
                        label: getPatientInfoFullNameUsingChosen(patient),
                        description: `Birthday: ${DateTime.fromFormat(patient.dateOfBirth || '', 'yyyy-MM-dd').toFormat(
                          'MMMM dd, yyyy'
                        )}`,
                        value: patient.id,
                        color: otherColors.lightBlue,
                      };
                    })
                    .concat(flow !== 'pastVisits' ? DIFFERENT_FAMILY_MEMBER_DATA : []),
            },
          ]}
          onSubmit={onSubmit}
          controlButtons={{
            onBack,
            submitDisabled: hasNoPatients,
          }}
          bottomComponent={
            hasNoPatients ? (
              <Box sx={{ pt: 2, color: 'text.primary' }}>No patients are found for this user.</Box>
            ) : undefined
          }
        />
      )}
    </CustomContainer>
  );
};

export default SelectPatient;
