import { Box, Typography, useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { BundleEntry, Organization, Patient, Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CoverageWithPriority,
  extractFirstValueFromAnswer,
  flattenItems,
  InsurancePlanDTO,
  makePrepopulatedItemsFromPatientRecord,
  OrderedCoveragesWithSubscribers,
  PatientAccountResponse,
  pruneEmptySections,
} from 'utils';
import { CustomDialog } from '../components/dialogs';
import { LoadingScreen } from '../components/LoadingScreen';
import {
  AboutPatientContainer,
  ActionBar,
  BreadCrumbs,
  ContactContainer,
  Header,
  InsuranceSection,
  PatientDetailsContainer,
  PrimaryCareContainer,
  ResponsibleInformationContainer,
  WarningBanner,
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

const COVERAGE_ITEMS = ['insurance-section', 'insurance-section-2'];
const ANSWER_TYPES: ('String' | 'Boolean' | 'Reference' | 'Attachment')[] = [
  'String',
  'Boolean',
  'Reference',
  'Attachment',
];

const getAnyAnswer = (item: QuestionnaireResponseItem): any | undefined => {
  for (let i = 0; i < ANSWER_TYPES.length; i++) {
    const answer = extractFirstValueFromAnswer(item.answer ?? [], ANSWER_TYPES[i]);
    if (answer !== undefined) {
      return answer;
    }
  }
  return undefined;
};

const makeFormDefaults = (currentItemValues: QuestionnaireResponseItem[]): Record<string, any> => {
  const flattened = flattenItems(currentItemValues);
  return flattened.reduce((acc: Record<string, any>, item: QuestionnaireResponseItem) => {
    const value = getAnyAnswer(item);
    acc[item.linkId] = value;
    return acc;
  }, {});
};

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

const transformInsurancePlans = (bundleEntries: BundleEntry[]): InsurancePlanDTO[] => {
  const organizations = bundleEntries
    .filter((bundleEntry) => bundleEntry.resource?.resourceType === 'Organization')
    .map((bundleEntry) => bundleEntry.resource as Organization);

  const transformedPlans = organizations
    .map((organization) => {
      try {
        return createInsurancePlanDto(organization);
      } catch (err) {
        console.error(err);
        console.log('Could not add insurance org due to incomplete data:', JSON.stringify(organization));
        return {} as InsurancePlanDTO;
      }
    })
    .filter((insurancePlan) => insurancePlan.id !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  const insurancePlanMap: Record<string, InsurancePlanDTO> = {};
  transformedPlans.forEach((plan) => {
    insurancePlanMap[plan.name ?? ''] = plan;
  });

  return Object.values(insurancePlanMap);
};

const usePatientData = (
  id: string | undefined
): {
  accountData?: PatientAccountResponse;
  insuranceData?: {
    coverages: OrderedCoveragesWithSubscribers;
    insuranceOrgs: Organization[];
  };
  questionnaire?: Questionnaire;
  coverages: CoverageWithPriority[];
  patient?: Patient;
  isFetching: boolean;
  defaultFormVals: any;
  coveragesFetching: boolean;
  questionnaireFetching: boolean;
} => {
  const apiClient = useOystehrAPIClient();

  const { isFetching: accountFetching, data: accountData } = useGetPatientAccount({
    apiClient,
    patientId: id ?? null,
  });

  const { data: insuranceData, isFetching: coveragesFetching } = useGetPatientCoverages({
    apiClient,
    patientId: id ?? null,
  });

  const { isFetching: questionnaireFetching, data: questionnaire } = useGetPatientDetailsUpdateForm();

  const coverages: CoverageWithPriority[] = useMemo(() => {
    if (!insuranceData?.coverages) return [];

    const result: CoverageWithPriority[] = [];
    if (insuranceData.coverages.primary) {
      result.push({ resource: insuranceData.coverages.primary, startingPriority: 1 });
    }
    if (insuranceData.coverages.secondary) {
      result.push({ resource: insuranceData.coverages.secondary, startingPriority: 2 });
    }

    return result;
  }, [insuranceData?.coverages]);

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
      defaultFormVals = makeFormDefaults(prepopulatedForm);
    }

    return { patient, isFetching, defaultFormVals };
  }, [accountData, questionnaire, questionnaireFetching, accountFetching]);

  return {
    accountData,
    insuranceData,
    questionnaire,
    coverages,
    patient,
    isFetching,
    defaultFormVals,
    coveragesFetching,
    questionnaireFetching,
  };
};

const useFormData = (
  defaultFormVals: any,
  coveragesFetching: boolean,
  insuranceData: any,
  questionnaire: Questionnaire | undefined,
  accountData: any
): {
  methods: ReturnType<typeof useForm>;
  coveragesFormValues: any;
} => {
  const methods = useForm({
    defaultValues: defaultFormVals,
    values: defaultFormVals,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { coveragesFormValues } = useMemo(() => {
    let coveragesFormValues: any;
    if (
      !coveragesFetching &&
      insuranceData?.coverages &&
      insuranceData?.insuranceOrgs &&
      questionnaire &&
      accountData
    ) {
      const formDefaults = makePrepopulatedCoveragesFormDefaults({
        coverages: insuranceData.coverages,
        patient: accountData.patient,
        insuranceOrgs: insuranceData.insuranceOrgs,
        questionnaire,
      });
      coveragesFormValues = { ...formDefaults };
    }
    return { coveragesFormValues };
  }, [accountData, coveragesFetching, questionnaire, insuranceData?.coverages, insuranceData?.insuranceOrgs]);

  useEffect(() => {
    if (!coveragesFormValues || Object.keys(coveragesFormValues).length === 0) return;

    Object.entries(coveragesFormValues).forEach(([key, value]) => {
      methods.setValue(key, value, {
        shouldDirty: false,
        shouldTouch: false,
      });
    });
  }, [coveragesFormValues, methods]);

  return { methods, coveragesFormValues };
};

const useMutations = (): {
  submitQR: ReturnType<typeof useUpdatePatientAccount>;
  removeCoverage: ReturnType<typeof useRemovePatientCoverage>;
  queryClient: ReturnType<typeof useQueryClient>;
} => {
  const queryClient = useQueryClient();

  const submitQR = useUpdatePatientAccount(async () => {
    await queryClient.invalidateQueries({ queryKey: ['patient-account-get'] });
    await queryClient.invalidateQueries({ queryKey: ['patient-coverages'] });
  });

  const removeCoverage = useRemovePatientCoverage();

  return { submitQR, removeCoverage, queryClient };
};

const PatientInformationPage: FC = () => {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const { setInsurancePlans } = usePatientStore();

  const {
    accountData,
    insuranceData,
    questionnaire,
    coverages,
    patient,
    isFetching,
    defaultFormVals,
    coveragesFetching,
    questionnaireFetching,
  } = usePatientData(id);

  const { methods, coveragesFormValues } = useFormData(
    defaultFormVals,
    coveragesFetching,
    insuranceData,
    questionnaire,
    accountData
  );

  const { submitQR, removeCoverage, queryClient } = useMutations();

  const { otherPatientsWithSameName, setOtherPatientsWithSameName } = useGetPatient(id);

  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false);
  const [openAddInsuranceModal, setOpenAddInsuranceModal] = useState(false);

  useGetInsurancePlans((data) => {
    if (!data) return;

    const bundleEntries = data.entry;
    if (bundleEntries) {
      const uniquePlans = transformInsurancePlans(bundleEntries);
      setInsurancePlans(uniquePlans);
    }
  });

  const { handleSubmit, watch, formState } = methods;
  const { dirtyFields } = formState;

  useEffect(() => {
    if (defaultFormVals && formState.isSubmitSuccessful && submitQR.isSuccess) {
      methods.reset();
    }
  }, [defaultFormVals, methods, formState.isSubmitSuccessful, submitQR.isSuccess]);

  useEffect(() => {
    if (!coveragesFormValues || Object.keys(coveragesFormValues).length === 0) return;

    Object.entries(coveragesFormValues).forEach(([key, value]) => {
      methods.setValue(key, value, {
        shouldDirty: false,
        shouldTouch: false,
      });
    });
  }, [coveragesFormValues, methods]);

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
            enqueueSnackbar('Coverage removed from patient account', { variant: 'success' });
            void queryClient.invalidateQueries({ queryKey: ['patient-coverages'] });
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
  }

  if (!patient) return null;

  const currentlyAssignedPriorities = watch(InsurancePriorityOptions);

  return (
    <div>
      {isFetching && <LoadingScreen />}
      <FormProvider {...methods}>
        <Box>
          <Header handleDiscard={handleBackClickWithConfirmation} id={id} />
          <Box sx={{ display: 'flex', flexDirection: 'column', padding: theme.spacing(3) }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <BreadCrumbs patient={patient} />
              <Typography variant="h3" color="primary.main">
                Patient Profile
              </Typography>
              <WarningBanner
                otherPatientsWithSameName={otherPatientsWithSameName}
                onClose={() => setOtherPatientsWithSameName(false)}
              />
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <AboutPatientContainer />
                  <ContactContainer />
                  <PatientDetailsContainer patient={patient} />
                  <PrimaryCareContainer />
                </Box>
                <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <InsuranceSection
                    coverages={coverages}
                    patient={patient}
                    accountData={accountData}
                    removeCoverage={removeCoverage}
                    onRemoveCoverage={handleRemoveCoverage}
                    onAddInsurance={() => setOpenAddInsuranceModal(true)}
                  />
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
            loading={submitQR.isPending}
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
