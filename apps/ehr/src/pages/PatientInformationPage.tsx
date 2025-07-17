import { otherColors } from '@ehrTheme/colors';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { BundleEntry, Coverage, Organization, Patient, Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  checkCoverageMatchesDetails,
  CoverageCheckWithDetails,
  extractFirstValueFromAnswer,
  flattenItems,
  getFullName,
  InsurancePlanDTO,
  makePrepopulatedItemsFromPatientRecord,
  OrderedCoveragesWithSubscribers,
  pruneEmptySections,
} from 'utils';
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
} from '../components/patient';
import { AddInsuranceModal } from '../components/patient/AddInsuranceModal';
import { INSURANCE_COVERAGE_OPTIONS, InsurancePriorityOptions } from '../constants';
import { structureQuestionnaireResponse } from '../helpers/qr-structure';
import {
  useGetInsurancePlans,
  useGetPatient,
  useGetPatientAccount,
  useGetPatientCoverages,
  useGetPatientDetailsUpdateForm,
  useRemovePatientCoverage,
  useUpdatePatientAccount,
} from '../hooks/useGetPatient';
import { createInsurancePlanDto, usePatientStore } from '../state/patient.store';
import { useOystehrAPIClient } from '../telemed/hooks/useOystehrAPIClient';

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

const getEligibilityCheckDetailsForCoverage = (
  coverage: Coverage,
  coverageChecks: CoverageCheckWithDetails[]
): CoverageCheckWithDetails | undefined => {
  return coverageChecks.find((check) => {
    return checkCoverageMatchesDetails(coverage, check);
  });
};

const makeFormDefaults = (currentItemValues: QuestionnaireResponseItem[]): any => {
  const flattened = flattenItems(currentItemValues);
  return flattened.reduce((acc: any, item: QuestionnaireResponseItem) => {
    const value = getAnyAnswer(item);
    acc[item.linkId] = value;
    return acc;
  }, {});
};
const COVERAGE_ITEMS = ['insurance-section', 'insurance-section-2'];
const makePrepopulatedCoveragesFormDefaults = ({
  coverages,
  patient,
  insuranceOrgs,
  questionnaire,
}: {
  coverages: OrderedCoveragesWithSubscribers;
  patient: Patient;
  insuranceOrgs: Organization[];
  questionnaire: Questionnaire;
}): Record<string, any> => {
  if (!questionnaire?.item) return {};

  const filteredQuestionnaire: Questionnaire = {
    ...questionnaire,
    item: questionnaire.item.filter((item) => COVERAGE_ITEMS.includes(item.linkId)),
  };

  const prepopulatedItems = makePrepopulatedItemsFromPatientRecord({
    coverages,
    patient,
    insuranceOrgs,
    questionnaire: filteredQuestionnaire,
    coverageChecks: [],
  });

  return makeFormDefaults(prepopulatedItems);
};

const clearPCPFieldsIfInactive = (values: Record<string, any>): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      !values['pcp-active'] && key.startsWith('pcp-') && key !== 'pcp-active' ? '' : value,
    ])
  );
};

const PatientInformationPage: FC = () => {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();

  const apiClient = useOystehrAPIClient();
  const { setInsurancePlans } = usePatientStore();

  // data queries
  const { isFetching: accountFetching, data: accountData } = useGetPatientAccount({ apiClient, patientId: id ?? null });
  console.log('accountData', accountData);

  const { data: insuranceData, isFetching: coveragesFetching } = useGetPatientCoverages({
    apiClient,
    patientId: id ?? null,
  });

  const coverages: { resource: Coverage; startingPriority: number }[] = useMemo(() => {
    if (!insuranceData?.coverages) return [];
    const result: { resource: Coverage; startingPriority: number }[] = [];
    if (insuranceData?.coverages.primary) {
      result.push({ resource: insuranceData?.coverages.primary, startingPriority: 1 });
    }
    if (insuranceData?.coverages.secondary) {
      result.push({ resource: insuranceData?.coverages.secondary, startingPriority: 2 });
    }
    console.log('coverages updated', result);
    return result;
  }, [insuranceData?.coverages]);
  console.log('rawCoverages', insuranceData?.coverages);
  const { isFetching: questionnaireFetching, data: questionnaire } = useGetPatientDetailsUpdateForm();
  // data mutations
  const queryClient = useQueryClient();
  const submitQR = useUpdatePatientAccount(async () => {
    await queryClient.invalidateQueries('patient-account-get');
    await queryClient.invalidateQueries('patient-coverages');
  });
  const removeCoverage = useRemovePatientCoverage();

  useGetInsurancePlans((data) => {
    const bundleEntries = data.entry;
    if (bundleEntries) {
      const organizations = bundleEntries
        .filter((bundleEntry: BundleEntry) => bundleEntry.resource?.resourceType === 'Organization')
        .map((bundleEntry: BundleEntry) => bundleEntry.resource as Organization);

      const transformedInsurancePlans = organizations
        .map((organization: Organization) => {
          try {
            return createInsurancePlanDto(organization);
          } catch (err) {
            console.error(err);
            console.log('Could not add insurance org due to incomplete data:', JSON.stringify(organization));
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

  const { patient, isFetching, defaultFormVals } = useMemo(() => {
    const patient = accountData?.patient;

    const isFetching = accountFetching || questionnaireFetching;
    let defaultFormVals: any;
    if (!isFetching && accountData && questionnaire) {
      const prepopulatedForm = makePrepopulatedItemsFromPatientRecord({
        ...accountData,
        coverages: {},
        insuranceOrgs: [],
        questionnaire,
      });
      const formDefaults = makeFormDefaults(prepopulatedForm);
      console.log('[defaultFormVals MEMO]', {
        isFetching,
        hasAccountData: !!accountData,
        hasQuestionnaire: !!questionnaire,
        defaultFormVals: formDefaults,
      });

      defaultFormVals = {
        ...formDefaults,
      };
    }
    return { patient, isFetching, defaultFormVals };
  }, [accountData, questionnaire, questionnaireFetching, accountFetching]);

  const { otherPatientsWithSameName, setOtherPatientsWithSameName } = useGetPatient(id);

  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false);
  const [openAddInsuranceModal, setOpenAddInsuranceModal] = useState(false);

  const methods = useForm({
    defaultValues: defaultFormVals,
    values: defaultFormVals,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  console.log('[useForm] defaultValues on init', defaultFormVals);
  const { coveragesFormValues } = useMemo(() => {
    let coveragesFormValues: any;
    if (
      !coveragesFetching &&
      insuranceData?.coverages &&
      insuranceData?.insuranceOrgs &&
      questionnaire &&
      accountData
    ) {
      console.log(insuranceData?.coverages);
      const formDefaults = makePrepopulatedCoveragesFormDefaults({
        coverages: insuranceData.coverages,
        patient: accountData.patient,
        insuranceOrgs: insuranceData.insuranceOrgs,
        questionnaire,
      });
      coveragesFormValues = { ...formDefaults };
    }
    console.log('coveragesFormValues', coveragesFormValues);
    return { coveragesFormValues };
  }, [accountData, coveragesFetching, questionnaire, insuranceData?.coverages, insuranceData?.insuranceOrgs]);

  useEffect(() => {
    if (!coveragesFormValues || Object.keys(coveragesFormValues).length === 0) return;
    console.log('[COVERAGES EFFECT] applying coveragesFormValues', coveragesFormValues);

    Object.entries(coveragesFormValues).forEach(([key, value]) => {
      methods.setValue(key, value, {
        shouldDirty: false,
        shouldTouch: false,
      });
    });
  }, [coveragesFormValues, methods]);

  const { handleSubmit, watch, formState } = methods;
  const { dirtyFields } = formState;
  console.log('dirtyFields', dirtyFields);

  useEffect(() => {
    if (defaultFormVals && formState.isSubmitSuccessful && submitQR.isSuccess) {
      methods.reset();
    }
  }, [defaultFormVals, methods, formState.isSubmitSuccessful, submitQR.isSuccess]);

  const handleDiscardChanges = (): void => {
    methods.reset();
    setOpenConfirmationDialog(false);
    navigate(-1);
  };

  const handleCloseConfirmationDialog = (): void => {
    setOpenConfirmationDialog(false);
  };

  const handleBackClickWithConfirmation = (): void => {
    if (Object.keys(dirtyFields).length > 0) {
      setOpenConfirmationDialog(true);
    } else {
      navigate(-1);
    }
  };

  const handleSaveForm = async (values: Record<string, any>): Promise<void> => {
    if (!questionnaire || !patient?.id) {
      enqueueSnackbar('Something went wrong. Please reload the page.', { variant: 'error' });
      return;
    }

    const filteredValues = clearPCPFieldsIfInactive(values);

    const qr = pruneEmptySections(structureQuestionnaireResponse(questionnaire, filteredValues, patient.id));
    submitQR.mutate(qr);
  };

  const handleRemoveCoverage = (coverageId: string): void => {
    if (patient?.id) {
      removeCoverage.mutate(
        {
          patientId: patient.id,
          coverageId,
        },
        {
          onSuccess: () => {
            enqueueSnackbar('Coverage removed from patient account', {
              variant: 'success',
            });
            void queryClient.invalidateQueries('patient-coverages');
          },
          onError: () => {
            enqueueSnackbar('Save operation failed. The server encountered an error while processing your request.', {
              variant: 'error',
            });
          },
        }
      );
    }
  };

  if ((isFetching || questionnaireFetching || coveragesFetching) && !patient) {
    return <LoadingScreen />;
  } else {
    if (!patient) return null;
  }

  const currentlyAssignedPriorities = watch(InsurancePriorityOptions);

  return (
    <div>
      {isFetching ? <LoadingScreen /> : null}
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
                    sx={{ m: 1.25, maxWidth: 850, fontWeight: 500 }}
                  >
                    There are other patients with this name in our database. Please confirm by the DOB that you are
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
                    <InsuranceContainer
                      key={coverage.resource.id}
                      patientId={patient.id ?? ''}
                      ordinal={coverage.startingPriority}
                      initialEligibilityCheck={getEligibilityCheckDetailsForCoverage(
                        coverage.resource,
                        accountData?.coverageChecks ?? []
                      )}
                      removeInProgress={removeCoverage.isLoading}
                      handleRemoveClick={
                        coverage.resource.id !== undefined
                          ? () => {
                              handleRemoveCoverage(coverage.resource.id!);
                            }
                          : undefined
                      }
                    />
                  ))}
                  {coverages.length < 2 && (
                    <Button
                      data-testid={dataTestIds.patientInformationPage.addInsuranceButton}
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
                </Box>
              </Box>
            </Box>
          </Box>
          <ActionBar
            handleDiscard={handleBackClickWithConfirmation}
            handleSave={handleSubmit(handleSaveForm, () => {
              enqueueSnackbar('Please fix all field validation errors and try again', { variant: 'error' });
            })}
            loading={submitQR.isLoading}
            hidden={false}
            submitDisabled={Object.keys(dirtyFields).length === 0}
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
      </FormProvider>
      <AddInsuranceModal
        open={openAddInsuranceModal}
        onClose={() => setOpenAddInsuranceModal(false)}
        questionnaire={questionnaire ?? { resourceType: 'Questionnaire', status: 'draft' }}
        patientId={patient.id ?? ''}
        priorityOptions={INSURANCE_COVERAGE_OPTIONS.filter(
          (option) => !currentlyAssignedPriorities.includes(option.value)
        )}
      />
    </div>
  );
};

export default PatientInformationPage;
