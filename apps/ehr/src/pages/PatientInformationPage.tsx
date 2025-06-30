import { otherColors } from '@ehrTheme/colors';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { BundleEntry, Coverage, InsurancePlan, Organization, QuestionnaireResponseItem } from 'fhir/r4b';
import _ from 'lodash';
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
  makePrepopulatedItemsFromPatientRecord,
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
  useGetPatientDetailsUpdateForm,
  useRemovePatientCoverage,
  useUpdatePatientAccount,
} from '../hooks/useGetPatient';
import { createInsurancePlanDto, InsurancePlanDTO, usePatientStore } from '../state/patient.store';
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

  const apiClient = useZapEHRAPIClient();
  const { setInsurancePlans } = usePatientStore();

  // data queries
  const { isFetching: accountFetching, data: accountData } = useGetPatientAccount({ apiClient, patientId: id ?? null });
  const { isFetching: questionnaireFetching, data: questionnaire } = useGetPatientDetailsUpdateForm();
  // data mutations
  const queryClient = useQueryClient();
  const submitQR = useUpdatePatientAccount(() => {
    void queryClient.invalidateQueries('patient-account-get');
  });
  const removeCoverage = useRemovePatientCoverage();

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

  const { patient, coverages, isFetching, defaultFormVals } = useMemo(() => {
    const patient = accountData?.patient;
    const coverages: { resource: Coverage; startingPriority: number }[] = [];
    if (accountData?.coverages?.primary) {
      coverages.push({ resource: accountData.coverages.primary, startingPriority: 1 });
    }
    if (accountData?.coverages?.secondary) {
      coverages.push({ resource: accountData.coverages.secondary, startingPriority: 2 });
    }
    const isFetching = accountFetching || questionnaireFetching;
    let defaultFormVals: any | undefined;
    if (!isFetching && accountData && questionnaire) {
      const prepopulatedForm = makePrepopulatedItemsFromPatientRecord({ ...accountData, questionnaire });
      defaultFormVals = makeFormDefaults(prepopulatedForm);
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
    reValidateMode: 'onChange',
  });

  const { handleSubmit, watch, formState } = methods;
  const { dirtyFields } = formState;

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
            void queryClient.invalidateQueries('patient-account-get');
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

  if ((isFetching || questionnaireFetching) && !patient) {
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
