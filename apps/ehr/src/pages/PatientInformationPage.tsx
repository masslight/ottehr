import { Box, Button, Typography, useTheme } from '@mui/material';
import { BundleEntry, Coverage, InsurancePlan, Organization, QuestionnaireResponseItem } from 'fhir/r4b';
import { FC, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { extractFirstValueFromAnswer, flattenItems, getFullName, makePrepopulatedItemsFromPatientRecord } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { CustomDialog } from '../components/dialogs';
import { LoadingScreen } from '../components/LoadingScreen';
import {
  AboutPatientContainer,
  ActionBar,
  ContactContainer,
  Header,
  InsuranceContainer,
  PatientDetailsContainer,
  PrimaryCareContainer,
  ResponsibleInformationContainer,
  SettingsContainer,
} from '../components/patient';
import {
  useGetInsurancePlans,
  useGetPatient,
  useGetPatientAccount,
  useGetPatientDetailsUpdateForm,
} from '../hooks/useGetPatient';
import { createInsurancePlanDto, InsurancePlanDTO, usePatientStore } from '../state/patient.store';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { otherColors } from '../CustomThemeProvider';
import { AddInsuranceModal } from '../components/patient/AddInsuranceModal';
import { useZapEHRAPIClient } from '../telemed/hooks/useOystehrAPIClient';

const getAnyAnswer = (item: QuestionnaireResponseItem): any | undefined => {
  let index = 0;
  let answer: any | undefined;
  const types: ('String' | 'Boolean' | 'Reference' | 'Attachment')[] = ['String', 'Boolean', 'Reference', 'Attachment'];

  do {
    answer = extractFirstValueFromAnswer(item.answer ?? [], types[index]);
    index++;
  } while (answer === undefined && index < types.length);
  return answer;
};

const makeFormDefaults = (currentItemValues: QuestionnaireResponseItem[]): any => {
  const flattened = flattenItems(currentItemValues);
  return flattened.reduce((acc: any, item: QuestionnaireResponseItem) => {
    const value = getAnyAnswer(item);
    acc[item.linkId] = value;
    return acc;
  }, {});
};

const PatientInformationPage: FC = () => {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();

  const apiClient = useZapEHRAPIClient();
  const { setInsurancePlans } = usePatientStore();
  const { isFetching: accountFetching, data: accountData } = useGetPatientAccount({ apiClient, patientId: id ?? null });

  useGetInsurancePlans((data) => {
    const bundleEntries = data.entry;
    if (bundleEntries) {
      const organizations = bundleEntries
        .filter((bundleEntry: BundleEntry) => bundleEntry.resource?.resourceType === 'Organization')
        .map((bundleEntry: BundleEntry) => bundleEntry.resource as Organization);

      const transformedInsurancePlans = bundleEntries
        .filter((bundleEntry: BundleEntry) => bundleEntry.resource?.resourceType === 'InsurancePlan')
        .map((bundleEntry: BundleEntry) => {
          const insurancePlanResource = bundleEntry.resource as InsurancePlan;

          try {
            const organizationId = insurancePlanResource.ownedBy?.reference?.split('/')[1];
            const organizationResource = organizations.find((organization) => organization.id === organizationId);

            if (!organizationResource) {
              throw new Error(`Organization resource is not found by id: ${organizationId}.`);
            }
            return createInsurancePlanDto(insurancePlanResource, organizationResource);
          } catch (err) {
            console.error(err);
            console.log('Could not add insurance plan due to incomplete data:', JSON.stringify(insurancePlanResource));
            return {} as InsurancePlanDTO;
          }
        })
        .filter((insurancePlan) => insurancePlan.id !== undefined)
        .sort((a, b) => {
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        });

      const insurancePlanMap: Record<string, InsurancePlanDTO> = {};

      transformedInsurancePlans.forEach((insurancePlan) => {
        insurancePlanMap[insurancePlan.name ?? ''] = insurancePlan;
      });

      const uniquePlans = Object.values(insurancePlanMap);

      setInsurancePlans(uniquePlans);
    }
  });

  const { isFetching: questionnaireFetching, data: questionnaire } = useGetPatientDetailsUpdateForm();

  const { patient, coverages, isFetching, defaultFormVals } = useMemo(() => {
    const patient = accountData?.patient;
    const coverages: Coverage[] = [];
    if (accountData?.coverages?.primary) {
      coverages.push(accountData.coverages.primary);
    }
    if (accountData?.coverages?.secondary) {
      coverages.push(accountData.coverages.secondary);
    }
    const isFetching = accountFetching || questionnaireFetching;
    let defaultFormVals: any | undefined;
    if (!isFetching && accountData && questionnaire) {
      console.log('accountData', accountData);
      const prepopulatedForm = makePrepopulatedItemsFromPatientRecord({ ...accountData, questionnaire });
      console.log('prepopulatedForm', prepopulatedForm);
      defaultFormVals = makeFormDefaults(prepopulatedForm);
      console.log('defaultFormVals', defaultFormVals);
    }
    return { patient, coverages, isFetching, defaultFormVals };
  }, [accountData, questionnaire, questionnaireFetching, accountFetching]);

  const { otherPatientsWithSameName, setOtherPatientsWithSameName } = useGetPatient(id);

  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false);
  const [openAddInsuranceModal, setOpenAddInsuranceModal] = useState(false);

  const methods = useForm({
    defaultValues: defaultFormVals,
    values: defaultFormVals,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (defaultFormVals) {
      methods.reset();
    }
  }, [defaultFormVals, methods]);

  if (!patient) return null;

  if (isFetching || questionnaireFetching) return <LoadingScreen />;

  const handleDiscardChanges = (): void => {
    methods.reset();
    setOpenConfirmationDialog(false);
    navigate(-1);
  };

  const handleCloseConfirmationDialog = (): void => {
    setOpenConfirmationDialog(false);
  };

  const handleBackClickWithConfirmation = (): void => {
    /*if (
      (patchOperations?.patient?.length ?? 0) > 0 ||
      Object.values(patchOperations?.coverages || {}).some((ops) => ops.length > 0) ||
      Object.values(patchOperations?.relatedPersons || {}).some((ops) => ops.length > 0)
    ) {
      setOpenConfirmationDialog(true);
    } else {
      navigate(-1);
    }*/
    navigate(-1);
  };

  return (
    <FormProvider {...methods}>
      <Box>
        <Header handleDiscard={handleBackClickWithConfirmation} id={id} />
        <Box sx={{ display: 'flex', flexDirection: 'column', padding: theme.spacing(3) }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <CustomBreadcrumbs
              chain={[
                { link: '/patients', children: 'Patients' },
                {
                  link: `/patient/${patient?.id}`,
                  children: patient ? getFullName(patient) : '',
                },
                {
                  link: '#',
                  children: `Patient Information`,
                },
              ]}
            />
            <Typography variant="h3" color="primary.main">
              Patient Information
            </Typography>
            {otherPatientsWithSameName && (
              <Box
                sx={{
                  marginTop: 1,
                  padding: 1,
                  background: otherColors.dialogNote,
                  borderRadius: '4px',
                }}
                display="flex"
              >
                <WarningAmberIcon sx={{ marginTop: 1, color: otherColors.warningIcon }} />
                <Typography
                  variant="body2"
                  color={otherColors.closeCross}
                  sx={{ m: 1.25, maxWidth: 850, fontWeight: 700 }}
                >
                  There are another patients with this name in our database. Please confirm by the DOB that you are
                  viewing the right patient.
                </Typography>
                <CloseIcon
                  onClick={() => setOtherPatientsWithSameName(false)}
                  sx={{ marginLeft: 'auto', marginRight: 0, marginTop: 1, color: otherColors.closeCross }}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AboutPatientContainer />
                <ContactContainer />
                <PatientDetailsContainer patient={patient} />
                <PrimaryCareContainer />
              </Box>
              <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {coverages.map((coverage) => (
                  <InsuranceContainer key={coverage.id} insuranceId={coverage.id!} />
                ))}
                {/*todo*/}
                {coverages.length < 2 && (
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setOpenAddInsuranceModal(true)}
                    sx={{
                      borderRadius: 25,
                      textTransform: 'none',
                      fontWeight: 'bold',
                      width: 'fit-content',
                    }}
                  >
                    + Add Insurance
                  </Button>
                )}
                <ResponsibleInformationContainer />
                <SettingsContainer />
              </Box>
            </Box>
          </Box>
        </Box>
        <ActionBar
          handleDiscard={handleBackClickWithConfirmation}
          questionnaire={questionnaire}
          patientId={patient.id ?? ''}
        />
      </Box>
      <CustomDialog
        open={openConfirmationDialog}
        handleClose={handleCloseConfirmationDialog}
        title="Discard Changes?"
        description="You have unsaved changes. Are you sure you want to discard them and go back?"
        closeButtonText="Cancel"
        handleConfirm={handleDiscardChanges}
        confirmText="Discard Changes"
      />
      <AddInsuranceModal open={openAddInsuranceModal} onClose={() => setOpenAddInsuranceModal(false)} />
    </FormProvider>
  );
};

export default PatientInformationPage;
