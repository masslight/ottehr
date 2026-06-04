import { Box, SxProps, Typography, useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Organization, Patient, Questionnaire, QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { PatientMergedBanner } from 'src/components/PatientMergedBanner';
import { AboutPatientContainer } from 'src/features/visits/shared/components/patient/AboutPatientContainer';
import { ActionBar } from 'src/features/visits/shared/components/patient/ActionBar';
import { AttorneyInformationContainer } from 'src/features/visits/shared/components/patient/AttorneyInformationContainer';
import { BreadCrumbs } from 'src/features/visits/shared/components/patient/BreadCrumbs';
import { ContactContainer } from 'src/features/visits/shared/components/patient/ContactContainer';
import { EmergencyContactContainer } from 'src/features/visits/shared/components/patient/EmergencyContactContainer';
import { EmployerInformationContainer } from 'src/features/visits/shared/components/patient/EmployerInformationContainer';
import { Header } from 'src/features/visits/shared/components/patient/Header';
import {
  buildInsuranceSectionCounts,
  useCoverageFormRehydration,
} from 'src/features/visits/shared/components/patient/insuranceFormHelpers';
import { InsuranceSection } from 'src/features/visits/shared/components/patient/InsuranceSection';
import { OccupationalMedicineEmployerInformationContainer } from 'src/features/visits/shared/components/patient/OccupationalMedicineEmployerContainer';
import { PatientDetailsContainer } from 'src/features/visits/shared/components/patient/PatientDetailsContainer';
import { createDynamicValidationResolver } from 'src/features/visits/shared/components/patient/patientRecordValidation';
import { PharmacyContainer } from 'src/features/visits/shared/components/patient/PharmacyContainer';
import { PrimaryCareContainer } from 'src/features/visits/shared/components/patient/PrimaryCareContainer';
import { ResponsibleInformationContainer } from 'src/features/visits/shared/components/patient/ResponsibleInformationContainer';
import { WarningBanner } from 'src/features/visits/shared/components/patient/WarningBanner';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  AppointmentContext,
  CoverageWithPriority,
  extractFirstValueFromAnswer,
  flattenItems,
  OrderedCoveragesWithSubscribers,
  PATIENT_RECORD_CONFIG,
  PATIENT_RECORD_QUESTIONNAIRE,
  PatientAccountResponse,
  prepopulatePatientRecordItems,
  pruneEmptySections,
} from 'utils';
import { CustomDialog } from '../components/dialogs';
import { LoadingScreen } from '../components/LoadingScreen';
import { structureQuestionnaireResponse } from '../helpers/qr-structure';
import {
  useGetPatient,
  useGetPatientAccount,
  useGetPatientCoverages,
  useRemovePatientCoverage,
  useUpdatePatientAccount,
} from '../hooks/useGetPatient';

const COVERAGE_ITEMS = ['insurance-section', 'insurance-section-2'];
const ANSWER_TYPES: ('String' | 'Boolean' | 'Reference' | 'Attachment')[] = [
  'String',
  'Boolean',
  'Reference',
  'Attachment',
];

const questionnaire = PATIENT_RECORD_QUESTIONNAIRE();

const getAnyAnswer = (item: QuestionnaireResponseItem): any | undefined => {
  for (let i = 0; i < ANSWER_TYPES.length; i++) {
    const answer = extractFirstValueFromAnswer(item.answer ?? [], ANSWER_TYPES[i]);
    if (answer !== undefined) {
      return answer;
    }
  }
  return undefined;
};

// Build a linkId -> form item type lookup so empty form fields can default to a
// type-appropriate value. Without this, undefined defaults make RHF treat
// "type then clear" as dirty, since MUI inputs emit '' (or false/null for
// checkboxes/references) and that never strict-equals undefined.
//
// Reference fields are emitted as FHIR type 'choice' but tagged with the
// answer-loading-options extension; surface them as 'reference' so they get a
// null default that matches what the Autocomplete clears to.
const ANSWER_LOADING_OPTIONS_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-loading-options';
const isReferenceItem = (item: QuestionnaireItem): boolean =>
  item.type === 'choice' && (item.extension?.some((ext) => ext.url === ANSWER_LOADING_OPTIONS_URL) ?? false);

const buildLinkIdTypeMap = (q: Questionnaire): Map<string, string> => {
  const map = new Map<string, string>();
  const walk = (items?: QuestionnaireItem[]): void => {
    if (!items) return;
    for (const item of items) {
      if (item.linkId && item.type) {
        map.set(item.linkId, isReferenceItem(item) ? 'reference' : item.type);
      }
      walk(item.item);
    }
  };
  walk(q.item);
  return map;
};
const linkIdTypes = buildLinkIdTypeMap(questionnaire);

const emptyDefaultForType = (type: string | undefined): any => {
  if (type === 'boolean') return false;
  if (type === 'reference' || type === 'attachment') return null;
  return '';
};

const makeFormDefaults = (currentItemValues: QuestionnaireResponseItem[]): Record<string, any> => {
  const flattened = flattenItems(currentItemValues);
  return flattened.reduce((acc: Record<string, any>, item: QuestionnaireResponseItem) => {
    const value = getAnyAnswer(item);
    acc[item.linkId] = value === undefined ? emptyDefaultForType(linkIdTypes.get(item.linkId)) : value;
    return acc;
  }, {});
};

const makePrepopulatedCoveragesFormDefaults = ({
  coverages,
  patient,
  insuranceOrgs,
  employerOrganization,
  questionnaire,
}: {
  coverages: OrderedCoveragesWithSubscribers;
  patient: Patient;
  insuranceOrgs: Organization[];
  employerOrganization?: Organization;
  questionnaire: Questionnaire;
}): Record<string, any> => {
  if (!questionnaire?.item) return {};

  const filteredQuestionnaire: Questionnaire = {
    ...questionnaire,
    item: questionnaire.item.filter(
      (item) => COVERAGE_ITEMS.includes(item.linkId) || item.linkId === 'employer-information-page'
    ),
  };

  const prepopulatedItems = prepopulatePatientRecordItems({
    coverages,
    patient,
    insuranceOrgs,
    questionnaire: filteredQuestionnaire,
    employerOrganization,
    coverageChecks: [],
  });

  return makeFormDefaults(prepopulatedItems);
};

const usePatientData = (
  id: string | undefined,
  appointmentContext?: AppointmentContext
): {
  accountData?: PatientAccountResponse;
  insuranceData?: {
    coverages: OrderedCoveragesWithSubscribers;
    insuranceOrgs: Organization[];
  };
  coverages: CoverageWithPriority[];
  patient?: Patient;
  isFetching: boolean;
  defaultFormVals: any;
  coveragesFetching: boolean;
} => {
  const apiClient = useOystehrAPIClient();

  const {
    isFetching: accountFetching,
    data: accountData,
    status: accountStatus,
  } = useGetPatientAccount({
    apiClient,
    patientId: id ?? null,
  });

  const { data: insuranceData, isFetching: coveragesFetching } = useGetPatientCoverages(
    {
      apiClient,
      patientId: id ?? null,
    },
    undefined,
    {
      enabled: accountStatus === 'success',
    }
  );

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
    const isFetching = accountFetching;

    let defaultFormVals: any;
    if (accountData && questionnaire) {
      const prepopulatedForm = prepopulatePatientRecordItems({
        ...accountData,
        coverages: insuranceData?.coverages ?? {},
        insuranceOrgs: insuranceData?.insuranceOrgs ?? [],
        questionnaire,
        appointmentContext,
      });
      defaultFormVals = makeFormDefaults(prepopulatedForm);
    }

    return { patient, isFetching, defaultFormVals };
  }, [accountData, accountFetching, appointmentContext, insuranceData?.coverages, insuranceData?.insuranceOrgs]);

  return {
    accountData,
    insuranceData,
    coverages,
    patient,
    isFetching,
    defaultFormVals,
    coveragesFetching,
  };
};

const useFormData = (
  defaultFormVals: any,
  coveragesFetching: boolean,
  insuranceData: any,
  accountData: any,
  isAddingInsurance?: boolean,
  newInsuranceOrdinal?: number,
  patientId?: string
): {
  methods: ReturnType<typeof useForm>;
  coveragesFormValues: any;
} => {
  // The dynamic resolver needs to know how many insurance ordinals are
  // actually rendered so it doesn't validate hidden ones.
  const renderedSectionCounts = buildInsuranceSectionCounts({
    hasPrimary: Boolean(insuranceData?.coverages?.primary),
    hasSecondary: Boolean(insuranceData?.coverages?.secondary),
    isAddingInsurance,
    newInsuranceOrdinal,
  });

  const methods = useForm({
    defaultValues: defaultFormVals,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: createDynamicValidationResolver({ renderedSectionCounts }),
  });

  // Populate form when data loads, and re-populate when navigating to a different
  // patient on the same mounted component (defaultValues only applies at mount time).
  const initializedForPatientRef = useRef<string | null>(null);
  useEffect(() => {
    if (defaultFormVals && initializedForPatientRef.current !== (patientId ?? null)) {
      methods.reset(defaultFormVals);
      initializedForPatientRef.current = patientId ?? null;
    }
  }, [defaultFormVals, methods, patientId]);

  const appointmentContextSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (!defaultFormVals) return;

    const employerVal = defaultFormVals['occupational-medicine-employer'];

    const employerKey =
      employerVal && typeof employerVal === 'object' && 'reference' in employerVal ? String(employerVal.reference) : '';

    const nextKey = [
      defaultFormVals['appointment-service-category'] ?? '',
      defaultFormVals['appointment-service-mode'] ?? '',
      defaultFormVals['reason-for-visit'] ?? '',
      employerKey,
    ].join('|');

    if (appointmentContextSyncRef.current === nextKey) return;

    appointmentContextSyncRef.current = nextKey;

    methods.setValue('appointment-service-category', defaultFormVals['appointment-service-category'], {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });

    methods.setValue('appointment-service-mode', defaultFormVals['appointment-service-mode'], {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });

    methods.setValue('reason-for-visit', defaultFormVals['reason-for-visit'], {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });

    if ('occupational-medicine-employer' in defaultFormVals) {
      methods.setValue('occupational-medicine-employer', defaultFormVals['occupational-medicine-employer'], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [defaultFormVals, methods]);

  const { coveragesFormValues } = useMemo(() => {
    let coveragesFormValues: any;
    if (!coveragesFetching && insuranceData?.coverages && insuranceData?.insuranceOrgs && accountData) {
      const formDefaults = makePrepopulatedCoveragesFormDefaults({
        coverages: insuranceData.coverages,
        patient: accountData.patient,
        insuranceOrgs: insuranceData.insuranceOrgs,
        employerOrganization: accountData.employerOrganization,
        questionnaire,
      });
      coveragesFormValues = { ...formDefaults };
    }
    return { coveragesFormValues };
  }, [accountData, coveragesFetching, insuranceData?.coverages, insuranceData?.insuranceOrgs]);

  useCoverageFormRehydration({
    coveragesFormValues,
    patientId,
    primaryCoverageId: insuranceData?.coverages?.primary?.id,
    secondaryCoverageId: insuranceData?.coverages?.secondary?.id,
    methods,
  });

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

interface PatientAccountComponentProps {
  id: string | undefined;
  title?: string;
  renderBreadCrumbs?: boolean;
  renderHeader?: boolean;
  containerSX?: SxProps;
  loadingComponent?: ReactElement;
  renderBackButton?: boolean;
  appointmentContext?: AppointmentContext;
  appointmentId?: string;
}

export const PatientAccountComponent: FC<PatientAccountComponentProps> = ({
  id,
  title,
  renderBreadCrumbs = false,
  renderHeader = false,
  containerSX = {},
  loadingComponent = <LoadingScreen />,
  renderBackButton = true,
  appointmentContext,
  appointmentId,
}) => {
  const navigate = useNavigate();

  const { accountData, insuranceData, coverages, patient, isFetching, defaultFormVals, coveragesFetching } =
    usePatientData(id, appointmentContext);

  // Determine ordinal for new insurance: next available priority slot
  const newInsuranceOrdinal = coverages.some((c) => c.startingPriority === 1) ? 2 : 1;

  const [isAddingInsurance, setIsAddingInsurance] = useState(false);

  const { methods } = useFormData(
    defaultFormVals,
    coveragesFetching,
    insuranceData,
    accountData,
    isAddingInsurance,
    newInsuranceOrdinal,
    id
  );

  const { submitQR, removeCoverage, queryClient } = useMutations();

  const { otherPatientsWithSameName, setOtherPatientsWithSameName } = useGetPatient(id);

  const [openConfirmationDialog, setOpenConfirmationDialog] = useState(false);

  const { handleSubmit, formState } = methods;
  const { dirtyFields } = formState;

  const insuranceItems = PATIENT_RECORD_CONFIG.FormFields.insurance.items;

  const handleStartAddInsurance = (): void => {
    setIsAddingInsurance(true);
    const index = newInsuranceOrdinal - 1;
    const fields = insuranceItems[index];
    if (fields) {
      // RHF keeps field state after DOM unmount, so a removed coverage's
      // values linger under keys the new inline form will reuse. Clear them
      // before showing the form.
      Object.values(fields).forEach((field) => {
        methods.setValue(field.key, '', { shouldDirty: false });
      });
      const priorityValue = newInsuranceOrdinal === 1 ? 'Primary' : 'Secondary';
      methods.setValue(fields.insurancePriority.key, priorityValue, { shouldDirty: true });
    }
  };

  const handleCancelAddInsurance = (): void => {
    setIsAddingInsurance(false);
    const index = newInsuranceOrdinal - 1;
    const fields = insuranceItems[index];
    if (fields) {
      Object.values(fields).forEach((field) => {
        methods.resetField(field.key, { defaultValue: undefined });
      });
    }
  };

  // Close the inline add form WITHOUT clearing field values. Used after a
  // successful section save: the values the user just saved must stay in the
  // form (the new coverage container will display them); only the inline form
  // slot itself needs to disappear so its Controllers cleanly unmount before
  // a coverage container mounts and claims the same field names — without
  // this, the inline form's name change (e.g. "insurance-priority" →
  // "insurance-priority-2") wipes the just-saved values out of form state.
  const handleCloseAddInsurance = (): void => {
    setIsAddingInsurance(false);
  };

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

  const handleSaveForm = async (values: any): Promise<void> => {
    if (!patient?.id) {
      enqueueSnackbar('Something went wrong. Please reload the page.', { variant: 'error' });
      return;
    }

    // Pass dirtyFields to track explicitly cleared fields
    const qr = pruneEmptySections(structureQuestionnaireResponse(questionnaire, values, patient.id, dirtyFields));
    if (appointmentContext?.encounterId) {
      qr.encounter = {
        reference: 'Encounter/' + appointmentContext.encounterId,
      };
    }
    await submitQR.mutateAsync(qr);
    methods.reset(values);
    setIsAddingInsurance(false);
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

  if ((isFetching || coveragesFetching) && !patient) {
    return loadingComponent;
  }

  if (!patient || !defaultFormVals) return loadingComponent;

  return (
    <div>
      {isFetching && <LoadingScreen />}
      <FormProvider {...methods}>
        <Box>
          {renderHeader && <Header handleDiscard={handleBackClickWithConfirmation} id={id} />}
          <Box sx={{ display: 'flex', flexDirection: 'column', ...containerSX, marginBottom: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {renderBreadCrumbs && <BreadCrumbs patient={patient} />}
              {title && (
                <Typography variant="h3" color="primary.main">
                  {title}
                </Typography>
              )}
              <PatientMergedBanner patient={patient} />
              <WarningBanner
                otherPatientsWithSameName={otherPatientsWithSameName}
                onClose={() => setOtherPatientsWithSameName(false)}
              />
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <AboutPatientContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <ContactContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <PatientDetailsContainer
                    patient={patient}
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <PrimaryCareContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                </Box>
                <Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <InsuranceSection
                    coverages={coverages}
                    patient={patient}
                    accountData={accountData}
                    removeCoverage={removeCoverage}
                    onRemoveCoverage={handleRemoveCoverage}
                    isAddingInsurance={isAddingInsurance}
                    onStartAddInsurance={handleStartAddInsurance}
                    onCancelAddInsurance={handleCancelAddInsurance}
                    onCloseAddInsurance={handleCloseAddInsurance}
                    newInsuranceOrdinal={newInsuranceOrdinal}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <ResponsibleInformationContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <EmployerInformationContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <OccupationalMedicineEmployerInformationContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                    appointmentId={appointmentId}
                    useUpdateVisitDetailsForEmployer={
                      Boolean(appointmentId) && appointmentContext?.appointmentServiceCategory === 'pre-op'
                    }
                  />
                  <AttorneyInformationContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <EmergencyContactContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
                  <PharmacyContainer
                    isLoading={isFetching || submitQR.isPending}
                    patientId={patient?.id}
                    encounterId={appointmentContext?.encounterId}
                  />
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
            backButtonHidden={renderBackButton === false}
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
    </div>
  );
};

const PatientInformationPage: FC = () => {
  const { id } = useParams();
  const theme = useTheme();
  return (
    <PatientAccountComponent
      id={id}
      title="Patient Profile"
      renderBreadCrumbs
      renderHeader
      containerSX={{ padding: theme.spacing(3) }}
    />
  );
};

export default PatientInformationPage;
