import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { Organization, Patient, Questionnaire, QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { ContainedPrimaryToggleButton } from 'src/components/ContainedPrimaryToggleButton';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { structureQuestionnaireResponse } from 'src/helpers/qr-structure';
import {
  extractFirstValueFromAnswer,
  flattenItems,
  OrderedCoveragesWithSubscribers,
  PATIENT_RECORD_QUESTIONNAIRE,
  prepopulatePatientRecordItems,
  pruneEmptySections,
} from 'utils';
import { useGetPatientAccount, useGetPatientCoverages } from '../../hooks/useGetPatient';
import { RoundedButton } from '../RoundedButton';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Each row in the diff table corresponds to a questionnaire item (linkId).
 * Form value for each row is the patient ID whose value should be kept.
 */
type FormValues = Record<string, string>;

interface DiffRow {
  linkId: string;
  label: string;
  section: string;
  isDifferent: boolean;
  /** Display value per patient ID */
  displayValues: Record<string, string>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ANSWER_TYPES: ('String' | 'Boolean' | 'Reference' | 'Attachment')[] = [
  'String',
  'Boolean',
  'Reference',
  'Attachment',
];

const COVERAGE_ITEMS = ['insurance-section', 'insurance-section-2'];

const questionnaire = PATIENT_RECORD_QUESTIONNAIRE();

// Items that are internal/logical and should not be shown in the diff
const HIDDEN_LINK_IDS = new Set([
  'should-display-ssn-field',
  'ssn-field-required',
  'appointment-service-category',
  'appointment-service-mode',
  'reason-for-visit',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getAnyAnswer = (item: QuestionnaireResponseItem): any | undefined => {
  for (let i = 0; i < ANSWER_TYPES.length; i++) {
    const answer = extractFirstValueFromAnswer(item.answer ?? [], ANSWER_TYPES[i]);
    if (answer !== undefined) return answer;
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

const makeCoveragesFormDefaults = ({
  coverages,
  patient,
  insuranceOrgs,
  employerOrganization,
  q,
}: {
  coverages: OrderedCoveragesWithSubscribers;
  patient: Patient;
  insuranceOrgs: Organization[];
  employerOrganization?: Organization;
  q: Questionnaire;
}): Record<string, any> => {
  if (!q?.item) return {};
  const filteredQ: Questionnaire = {
    ...q,
    item: q.item.filter((item) => COVERAGE_ITEMS.includes(item.linkId) || item.linkId === 'employer-information-page'),
  };
  const items = prepopulatePatientRecordItems({
    coverages,
    patient,
    insuranceOrgs,
    questionnaire: filteredQ,
    coverageChecks: [],
    employerOrganization,
  });
  return makeFormDefaults(items);
};

/**
 * Display a form value as a human-readable string for the diff table.
 */
const formatDisplayValue = (value: any): string => {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (value.display) return value.display;
    if (value.reference) return value.reference;
    return JSON.stringify(value);
  }
  const str = String(value).trim();
  return str.length > 0 ? str : '-';
};

/**
 * Collect all leaf QuestionnaireItems (the actual fields) from a Questionnaire,
 * preserving section context via their parent group's text.
 */
const collectQuestionnaireFields = (q: Questionnaire): { linkId: string; label: string; section: string }[] => {
  const fields: { linkId: string; label: string; section: string }[] = [];

  const walkItems = (items: QuestionnaireItem[], sectionLabel: string): void => {
    for (const item of items) {
      if (HIDDEN_LINK_IDS.has(item.linkId)) continue;

      if (item.item && item.item.length > 0) {
        walkItems(item.item, item.text || sectionLabel);
      } else if (item.type !== 'display') {
        fields.push({
          linkId: item.linkId,
          label: item.text || item.linkId,
          section: sectionLabel,
        });
      }
    }
  };

  walkItems(q.item || [], '');
  return fields;
};

// ─── Component ────────────────────────────────────────────────────────────────

type PatientMergeDifferenceProps = {
  open: boolean;
  close: () => void;
  patientIds: [string, string];
  /** Called after a successful merge so the parent can refresh data. */
  onSuccess?: () => void;
};

export const PatientsMergeDifference: FC<PatientMergeDifferenceProps> = (props) => {
  const { open, close, patientIds, onSuccess } = props;

  const theme = useTheme();
  const lightBackground = `${theme.palette.primary.main}0A`;

  // The first patient is the "main" (surviving) patient
  const [mainPatientId, setMainPatientId] = useState<string>(patientIds[0]);
  const otherPatientId = patientIds.find((id) => id !== mainPatientId)!;

  const [showVariant, setShowVariant] = useState<'different' | 'all'>('different');

  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();

  // ── Fetch patient account data using the same hooks as PatientInformationPage ──

  const { data: mainAccountData, isFetching: mainFetching } = useGetPatientAccount({
    apiClient,
    patientId: mainPatientId,
  });

  const { data: mainInsuranceData, isFetching: mainCoverageFetching } = useGetPatientCoverages({
    apiClient,
    patientId: mainPatientId,
  });

  const { data: otherAccountData, isFetching: otherFetching } = useGetPatientAccount({
    apiClient,
    patientId: otherPatientId,
  });

  const { data: otherInsuranceData, isFetching: otherCoverageFetching } = useGetPatientCoverages({
    apiClient,
    patientId: otherPatientId,
  });

  const isLoading = mainFetching || otherFetching || mainCoverageFetching || otherCoverageFetching;

  // ── Build form defaults from prepopulated QR items (same as PatientInformationPage) ──

  const mainFormVals = useMemo(() => {
    if (!mainAccountData) return undefined;
    const items = prepopulatePatientRecordItems({
      ...mainAccountData,
      coverages: {},
      insuranceOrgs: [],
      questionnaire,
    });
    const base = makeFormDefaults(items);

    if (mainInsuranceData?.coverages && mainInsuranceData?.insuranceOrgs) {
      const coverageVals = makeCoveragesFormDefaults({
        coverages: mainInsuranceData.coverages,
        patient: mainAccountData.patient,
        insuranceOrgs: mainInsuranceData.insuranceOrgs,
        employerOrganization: mainAccountData.employerOrganization,
        q: questionnaire,
      });
      Object.assign(base, coverageVals);
    }
    return base;
  }, [mainAccountData, mainInsuranceData]);

  const otherFormVals = useMemo(() => {
    if (!otherAccountData) return undefined;
    const items = prepopulatePatientRecordItems({
      ...otherAccountData,
      coverages: {},
      insuranceOrgs: [],
      questionnaire,
    });
    const base = makeFormDefaults(items);

    if (otherInsuranceData?.coverages && otherInsuranceData?.insuranceOrgs) {
      const coverageVals = makeCoveragesFormDefaults({
        coverages: otherInsuranceData.coverages,
        patient: otherAccountData.patient,
        insuranceOrgs: otherInsuranceData.insuranceOrgs,
        employerOrganization: otherAccountData.employerOrganization,
        q: questionnaire,
      });
      Object.assign(base, coverageVals);
    }
    return base;
  }, [otherAccountData, otherInsuranceData]);

  // Map of patient ID → form values for quick lookup
  const formValsByPatient = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    if (mainFormVals) map[mainPatientId] = mainFormVals;
    if (otherFormVals) map[otherPatientId] = otherFormVals;
    return map;
  }, [mainFormVals, otherFormVals, mainPatientId, otherPatientId]);

  // ── Build diff rows from questionnaire items ──

  const questionnaireFields = useMemo(() => collectQuestionnaireFields(questionnaire), []);

  const diffRows = useMemo(() => {
    if (!mainFormVals || !otherFormVals) return [];

    return questionnaireFields.map(({ linkId, label, section }): DiffRow => {
      const mainDisplay = formatDisplayValue(mainFormVals[linkId]);
      const otherDisplay = formatDisplayValue(otherFormVals[linkId]);

      return {
        linkId,
        label,
        section,
        isDifferent: mainDisplay !== otherDisplay,
        displayValues: {
          [mainPatientId]: mainDisplay,
          [otherPatientId]: otherDisplay,
        },
      };
    });
  }, [mainFormVals, otherFormVals, mainPatientId, otherPatientId, questionnaireFields]);

  const visibleRows = useMemo(
    () => (showVariant === 'all' ? diffRows : diffRows.filter((r) => r.isDifferent)),
    [diffRows, showVariant]
  );

  // ── Form: each field's value is the patient ID whose value to keep ──

  const defaultFormValues = useMemo(() => {
    const defaults: FormValues = {};
    for (const field of questionnaireFields) {
      defaults[field.linkId] = mainPatientId;
    }
    return defaults;
  }, [questionnaireFields, mainPatientId]);

  const methods = useForm<FormValues>({ defaultValues: defaultFormValues });
  const { control, handleSubmit, reset } = methods;

  // ── Mutations ──

  const mergeMutation = useMutation({
    mutationKey: ['merge-patients'],
    mutationFn: async (params: {
      mainPatientId: string;
      otherPatientId: string;
      questionnaireResponse: ReturnType<typeof pruneEmptySections>;
    }) => {
      if (!apiClient) throw new Error('API client not initialized');
      return apiClient.mergePatients({
        mainPatientId: params.mainPatientId,
        otherPatientId: params.otherPatientId,
        questionnaireResponse: params.questionnaireResponse,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patient-account-get'] });
      await queryClient.invalidateQueries({ queryKey: ['patient-coverages'] });
      await queryClient.invalidateQueries({ queryKey: ['useGetPatientPatientResources'] });
      await queryClient.invalidateQueries({ queryKey: ['otherPatientsWithSameNameResources'] });
      enqueueSnackbar('Patients merged successfully', { variant: 'success' });
      onSuccess?.();
    },
    onError: (error) => {
      const message = error instanceof Error && error.message ? error.message : 'Failed to merge patients';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  // ── Handlers ──

  const changeMainPatient = (newMainId: string): void => {
    setMainPatientId(newMainId);
    // Reset all selections to the new main patient
    const newValues: FormValues = {};
    for (const field of questionnaireFields) {
      newValues[field.linkId] = newMainId;
    }
    reset(newValues);
  };

  const onSave = (values: FormValues): void => {
    if (!mainFormVals || !otherFormVals) return;

    const mainPid = mainPatientId;

    const mergedFormValues: Record<string, any> = {};
    for (const { linkId } of questionnaireFields) {
      const selectedPatientId = values[linkId] || mainPid;
      const patientVals = formValsByPatient[selectedPatientId];
      if (patientVals) {
        mergedFormValues[linkId] = patientVals[linkId];
      }
    }

    const dirtyFields: Record<string, boolean> = {};
    for (const { linkId } of questionnaireFields) {
      const selectedPatientId = values[linkId] || mainPid;
      if (selectedPatientId !== mainPid) {
        dirtyFields[linkId] = true;
      }
    }

    const qr = pruneEmptySections(
      structureQuestionnaireResponse(questionnaire, mergedFormValues, mainPid, dirtyFields)
    );

    close();

    mergeMutation.mutate({
      mainPatientId: mainPid,
      otherPatientId,
      questionnaireResponse: qr,
    });
  };

  // ── Render ──

  // Group rows by section for visual clarity
  const sections = useMemo(() => {
    const sectionMap = new Map<string, DiffRow[]>();
    for (const row of visibleRows) {
      const key = row.section || 'Other';
      if (!sectionMap.has(key)) sectionMap.set(key, []);
      sectionMap.get(key)!.push(row);
    }
    return Array.from(sectionMap.entries());
  }, [visibleRows]);

  return (
    <FormProvider {...methods}>
      <Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
        <IconButton size="small" onClick={close} sx={{ position: 'absolute', right: 16, top: 16 }}>
          <CloseIcon fontSize="small" />
        </IconButton>

        <Stack spacing={2} sx={{ p: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h4" color="primary.dark">
              Merge Patients
            </Typography>
            <Typography>
              Compare patient records and select which value to keep for each field. The selected values will be saved
              to the Main Patient record.
            </Typography>
            <Alert severity="info" sx={{ mt: 1 }}>
              All visits, clinical data (allergies, medications, surgical history, hospitalizations, etc.), follow-up
              encounters, labs and other order types, billing records will be automatically transferred to the main
              patient.
            </Alert>
          </Stack>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={showVariant}
                onChange={(_, newValue) => newValue && setShowVariant(newValue)}
              >
                <ContainedPrimaryToggleButton value="different">Only Different Info</ContainedPrimaryToggleButton>
                <ContainedPrimaryToggleButton value="all">All Info</ContainedPrimaryToggleButton>
              </ToggleButtonGroup>

              <TableContainer sx={{ maxHeight: '60vh' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>Parameter</TableCell>
                      {patientIds.map((pid) => (
                        <TableCell
                          key={pid}
                          sx={{
                            fontWeight: 'bold',
                            backgroundColor: pid === mainPatientId ? lightBackground : undefined,
                          }}
                        >
                          PID: {pid}
                          {pid === mainPatientId && (
                            <Typography variant="caption" display="block" color="primary">
                              Main Patient
                            </Typography>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Main patient selection row */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Main Patient Record</TableCell>
                      {patientIds.map((pid) => (
                        <TableCell
                          key={pid}
                          sx={{
                            backgroundColor: pid === mainPatientId ? lightBackground : undefined,
                          }}
                        >
                          <RadioGroup row value={mainPatientId} onChange={(e) => changeMainPatient(e.target.value)}>
                            <FormControlLabel value={pid} control={<Radio />} label="" />
                          </RadioGroup>
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Data rows grouped by section */}
                    {sections.map(([sectionTitle, rows]) => [
                      <TableRow key={`section-${sectionTitle}`}>
                        <TableCell
                          colSpan={patientIds.length + 1}
                          sx={{
                            fontWeight: 700,
                            backgroundColor: theme.palette.grey[100],
                            py: 0.5,
                          }}
                        >
                          {sectionTitle}
                        </TableCell>
                      </TableRow>,
                      ...rows.map((row) => (
                        <TableRow key={row.linkId}>
                          <TableCell>{row.label}</TableCell>
                          {patientIds.map((pid) => (
                            <TableCell
                              key={pid}
                              sx={{
                                backgroundColor: pid === mainPatientId ? lightBackground : undefined,
                              }}
                            >
                              <Controller
                                name={row.linkId}
                                control={control}
                                render={({ field: { onChange, value } }) => (
                                  <RadioGroup row value={value} onChange={onChange}>
                                    <FormControlLabel
                                      value={pid}
                                      control={<Radio size="small" />}
                                      label={row.displayValues[pid] || '-'}
                                    />
                                  </RadioGroup>
                                )}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      )),
                    ])}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack direction="row" spacing={2} justifyContent="space-between">
                <RoundedButton onClick={close}>Cancel</RoundedButton>
                <ConfirmationDialog
                  title="Merge Patient"
                  description={
                    <Stack spacing={2}>
                      <Typography>
                        Are you sure you want to merge patient records? Merged records will be deactivated.
                      </Typography>
                      <Stack>
                        <Typography fontWeight={600}>Merged patient record PID:</Typography>
                        <Typography sx={{ wordBreak: 'break-all' }}>{otherPatientId}</Typography>
                      </Stack>
                      <Stack>
                        <Typography fontWeight={600}>Main patient record PID:</Typography>
                        <Typography sx={{ wordBreak: 'break-all' }}>{mainPatientId}</Typography>
                      </Stack>
                    </Stack>
                  }
                  response={handleSubmit(onSave)}
                  actionButtons={{
                    proceed: { text: 'Confirm merge' },
                    back: { text: 'Cancel' },
                    reverse: true,
                  }}
                >
                  {(showDialog) => (
                    <RoundedButton
                      variant="contained"
                      onClick={showDialog}
                      disabled={isLoading || mergeMutation.isPending}
                    >
                      {mergeMutation.isPending ? 'Merging...' : 'Merge Patients'}
                    </RoundedButton>
                  )}
                </ConfirmationDialog>
              </Stack>
            </>
          )}
        </Stack>
      </Dialog>
    </FormProvider>
  );
};
