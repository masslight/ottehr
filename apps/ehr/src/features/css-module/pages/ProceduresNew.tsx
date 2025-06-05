import { ReactElement, useEffect, useMemo, useState } from 'react';
import { PageTitle } from 'src/telemed/components/PageTitle';
import {
  AccordionCard,
  ActionsList,
  DeleteIconButton,
  useAppointmentStore,
  useDebounce,
  useDeleteChartData,
  useGetAppointmentAccessibility,
  useGetIcd10Search,
  useSaveChartData,
} from 'src/telemed';
import { Box, Stack } from '@mui/system';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import {
  Autocomplete,
  Backdrop,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { RoundedButton } from 'src/components/RoundedButton';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import {
  CPTCodeDTO,
  DiagnosisDTO,
  getSelectors,
  getVisitStatus,
  IcdSearchResponse,
  REQUIRED_FIELD_ERROR_MESSAGE,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { DiagnosesField } from 'src/telemed/features/appointment/AssessmentTab';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTER_PATH } from '../routing/routesCSS';
import { InfoAlert } from '../components/InfoAlert';
import { enqueueSnackbar } from 'notistack';
import { DateTime } from 'luxon';
import { useFeatureFlags } from '../context/featureFlags';

const OTHER = 'Other';
const PROCEDURE_TYPES = [
  'Laceration Repair (Suturing/Stapling)',
  'Wound Care / Dressing Change',
  'Splint Application / Immobilization',
  'Incision and Drainage (I&D) of Abscess',
  'Reduction of Nursemaid’s Elbow',
  'Burn Treatment / Dressing',
  'Foreign Body Removal (Skin, Ear, Nose, Eye)',
  'Nail Trephination (Subungual Hematoma Drainage)',
  'Tick or Insect Removal',
  'Staple or Suture Removal',
  'Intravenous (IV) Catheter Placement',
  'IV Fluid Administration',
  'Intramuscular (IM) Medication Injection',
  'Nebulizer Treatment (e.g., Albuterol)',
  'Oral Rehydration / Medication Administration (including challenge doses)',
  'Wart Treatment (Cryotherapy with Liquid Nitrogen',
  'Urinary Catheterization',
  'Ear Lavage / Cerumen Removal',
  'Nasal Packing (Epistaxis Control)',
  'Eye Irrigation or Eye Foreign Body Removal',
  'Nasal Lavage (schnozzle)',
  'EKG',
];
const PRE_POPULATED_CPT_CODE: Record<string, CPTCodeDTO> = {
  'Nebulizer Treatment (e.g., Albuterol)': {
    code: '94640',
    display:
      'Pressurized or nonpressurized inhalation treatment for acute airway obstruction for therapeutic purposes and/or for diagnostic purposes such as sputum induction with an aerosol generator, nebulizer, metered dose inhaler or intermittent positive pressure breathing (IPPB) device',
  },
  'Wart Treatment (Cryotherapy with Liquid Nitrogen': {
    code: '17110',
    display:
      'Destruction (eg, laser surgery, electrosurgery, cryosurgery, chemosurgery, surgical curettement), of benign lesions other than skin tags or cutaneous vascular proliferative lesions; up to 14 lesions',
  },
  'Nail Trephination (Subungual Hematoma Drainage)': {
    code: '11740',
    display: 'Evacuation of subungual hematoma',
  },
  'Tick or Insect Removal': {
    code: '10120',
    display: 'Incision and removal of foreign body, subcutaneous tissues; simple',
  },
  'Nasal Packing (Epistaxis Control)': {
    code: '30901',
    display: 'Control nasal hemorrhage, anterior, simple (limited cautery and/or packing) any method',
  },
  EKG: {
    code: '93000',
    display: 'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report',
  },
  'Intramuscular (IM) Medication Injection': {
    code: '96372',
    display:
      'Therapeutic, prophylactic, or diagnostic injection (specify substance or drug); subcutaneous or intramuscular',
  },
};
const PERFORMED_BY = ['Clinical support staff', 'Provider', 'Both'];
const MEDICATIONS_USED = ['None', 'Topical', 'Local', 'Oral', 'IV', 'IM'];
const SITES = ['Head', 'Face', 'Arm', 'Leg', 'Torso', 'Genital', 'Ear', 'Nose', 'Eye', OTHER];
const SIDES_OF_BODY = ['Left', 'Right', 'Midline', 'Not Applicable'];
const TECHNIQUES = ['Sterile', 'Clean', 'Aseptic', 'Field'];
const SUPPLIES = ['Suture Kit', 'Splint', 'Irrigation Syringe', 'Speculum', 'Forceps', 'IV Kit', OTHER];
const SPECIMEN_SENT = ['Yes', 'No'];
const COMPLICATIONS = ['None', 'Bleeding', 'Incomplete Removal', 'Allergic Reaction', OTHER];
const PATIENT_RESPONSES = ['Tolerated Well', 'Mild Distress', 'Severe Distress', 'Improved', 'Stable', 'Worsened'];
const POST_PROCEDURE_INSTRUCTIONS = ['Wound Care', 'F/U with PCP', 'Return if worsening', OTHER];
const TIME_SPENT = ['< 5 min', '5-10 min', '10-20 min', '20-30 min', '> 30 min'];
const DOCUMENTED_BY = ['Provider', 'Clinical support staff'];

interface PageState {
  consentObtained?: boolean;
  procedureType?: string;
  cptCodes?: CPTCodeDTO[];
  diagnoses?: DiagnosisDTO[];
  procedureDate?: DateTime | null;
  procedureTime?: DateTime | null;
  performerType?: string;
  medicationUsed?: string;
  bodySite?: string;
  otherBodySite?: string;
  bodySide?: string;
  technique?: string;
  suppliesUsed?: string;
  otherSuppliesUsed?: string;
  procedureDetails?: string;
  specimenSent?: boolean;
  complications?: string;
  otherComplications?: string;
  patientResponse?: string;
  postInstructions?: string;
  otherPostInstructions?: string;
  timeSpent?: string;
  documentedBy?: string;
}

export default function ProceduresNew(): ReactElement {
  const navigate = useNavigate();
  const { id: appointmentId, procedureId } = useParams();
  const { chartData, setPartialChartData, appointment, encounter } = getSelectors(useAppointmentStore, [
    'chartData',
    'setPartialChartData',
    'appointment',
    'encounter',
  ]);
  const inPersonStatus = useMemo(() => appointment && getVisitStatus(appointment, encounter), [appointment, encounter]);
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { css } = useFeatureFlags();
  const isReadOnly = useMemo(() => {
    if (css) {
      return inPersonStatus === 'completed';
    }
    return appointmentAccessibility.status === TelemedAppointmentStatusEnum.complete;
  }, [css, inPersonStatus, appointmentAccessibility.status]);
  const chartCptCodes = chartData?.cptCodes || [];
  const chartDiagnoses = chartData?.diagnosis || [];
  const chartProcedures = chartData?.procedures || [];
  const { mutateAsync: saveChartData } = useSaveChartData();
  const { mutateAsync: deleteChartData } = useDeleteChartData();

  const [state, setState] = useState<PageState>({
    procedureDate: DateTime.now(),
    procedureTime: DateTime.now(),
  });
  const [saveInProgress, setSaveInProgress] = useState<boolean>(false);

  const updateState = (stateMutator: (state: PageState) => void): void => {
    stateMutator(state);
    setState({ ...state });
  };

  const [initialValuesSet, setInitialValuesSet] = useState<boolean>(false);
  useEffect(() => {
    const procedure = chartData?.procedures?.find((procedure) => procedure.resourceId === procedureId);
    if (procedure == null || initialValuesSet) {
      return;
    }
    const procedureDateTime =
      procedure.procedureDateTime != null ? DateTime.fromISO(procedure.procedureDateTime) : undefined;
    setState({
      procedureType: procedure.procedureType,
      cptCodes: procedure.cptCodes,
      diagnoses: procedure.diagnoses,
      procedureDate: procedureDateTime,
      procedureTime: procedureDateTime,
      performerType: procedure.performerType,
      medicationUsed: procedure.medicationUsed,
      bodySite: getValueForOtherable(procedure.bodySite, SITES),
      otherBodySite: getOtherValueForOtherable(procedure.bodySite, SITES),
      bodySide: procedure.bodySide,
      technique: procedure.technique,
      suppliesUsed: getValueForOtherable(procedure.suppliesUsed, SUPPLIES),
      otherSuppliesUsed: getOtherValueForOtherable(procedure.suppliesUsed, SUPPLIES),
      procedureDetails: procedure.procedureDetails,
      specimenSent: procedure.specimenSent,
      complications: getValueForOtherable(procedure.complications, COMPLICATIONS),
      otherComplications: getOtherValueForOtherable(procedure.complications, COMPLICATIONS),
      patientResponse: procedure.patientResponse,
      postInstructions: getValueForOtherable(procedure.postInstructions, POST_PROCEDURE_INSTRUCTIONS),
      otherPostInstructions: getOtherValueForOtherable(procedure.postInstructions, POST_PROCEDURE_INSTRUCTIONS),
      timeSpent: procedure.timeSpent,
      documentedBy: procedure.documentedBy,
      consentObtained: procedure.consentObtained,
    });
    setInitialValuesSet(true);
  }, [procedureId, chartData?.procedures, setState, initialValuesSet]);

  const onCancel = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
  };

  const onSave = async (): Promise<void> => {
    setSaveInProgress(true);
    try {
      const saveCptAndDiagnosesResponse = await saveChartData({
        cptCodes: state.cptCodes?.filter((cptCode) => cptCode.resourceId == null) ?? [],
        diagnosis: state.diagnoses?.filter((diagnosis) => diagnosis.resourceId == null) ?? [],
      });
      const savedCptCodes = saveCptAndDiagnosesResponse.chartData?.cptCodes;
      if (savedCptCodes) {
        setPartialChartData({
          cptCodes: [...chartCptCodes, ...savedCptCodes],
        });
      }
      const savedDiagnoses = saveCptAndDiagnosesResponse.chartData?.diagnosis;
      if (savedDiagnoses) {
        setPartialChartData({
          diagnosis: [...chartDiagnoses, ...savedDiagnoses],
        });
      }
      const cptCodesToUse = [
        ...(savedCptCodes ?? []),
        ...(state.cptCodes?.filter((cptCode) => cptCode.resourceId != null) ?? []),
      ];
      const diagnosesToUse = [
        ...(savedDiagnoses ?? []),
        ...(state.diagnoses?.filter((diagnosis) => diagnosis.resourceId != null) ?? []),
      ];
      const saveProcdureResponse = await saveChartData({
        procedures: [
          {
            resourceId: procedureId,
            procedureType: state.procedureType,
            cptCodes: cptCodesToUse,
            diagnoses: diagnosesToUse,
            procedureDateTime: state.procedureDate
              ?.set({ hour: state.procedureTime?.hour, minute: state.procedureTime?.minute })
              ?.toUTC()
              ?.toString(),
            documentedDateTime: DateTime.now().toUTC().toString(),
            performerType: state.performerType,
            medicationUsed: state.medicationUsed,
            bodySite: state.bodySite !== OTHER ? state.bodySite : state.otherBodySite,
            bodySide: state.bodySide,
            technique: state.technique,
            suppliesUsed: state.suppliesUsed !== OTHER ? state.suppliesUsed : state.otherSuppliesUsed,
            procedureDetails: state.procedureDetails,
            specimenSent: state.specimenSent,
            complications: state.complications !== OTHER ? state.complications : state.otherComplications,
            patientResponse: state.patientResponse,
            postInstructions: state.postInstructions !== OTHER ? state.postInstructions : state.otherPostInstructions,
            timeSpent: state.timeSpent,
            documentedBy: state.documentedBy,
            consentObtained: state.consentObtained,
          },
        ],
      });
      const oldProcedure = chartData?.procedures?.find((procedure) => procedure.resourceId === procedureId);
      if (oldProcedure != null) {
        await deleteChartData({
          cptCodes: oldProcedure.cptCodes?.filter(
            (cptCode) => cptCodesToUse.find((cptCodeToUse) => cptCodeToUse.resourceId == cptCode.resourceId) == null
          ),
          diagnosis: oldProcedure.diagnoses?.filter(
            (diagnosis) =>
              diagnosesToUse.find((diagnosisToUse) => diagnosisToUse.resourceId == diagnosis.resourceId) == null
          ),
        });
      }
      const savedProcedure = saveProcdureResponse.chartData?.procedures?.[0];
      if (savedProcedure) {
        setPartialChartData({
          procedures: [
            ...chartProcedures.filter((procedure) => procedure.resourceId !== procedureId),
            {
              ...savedProcedure,
              cptCodes: cptCodesToUse,
              diagnoses: diagnosesToUse,
            },
          ],
        });
      }
      setSaveInProgress(false);
      enqueueSnackbar('Procedure saved!', { variant: 'success' });
      navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
    } catch {
      setSaveInProgress(false);
      enqueueSnackbar('An error has occurred while saving procedure. Please try again.', { variant: 'error' });
    }
  };

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'CPT' });
  const cptSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const cptWidget = (): ReactElement => {
    return (
      <>
        <Autocomplete
          fullWidth
          blurOnSelect
          options={cptSearchOptions}
          noOptionsText={
            debouncedSearchTerm && cptSearchOptions.length === 0
              ? 'Nothing found for this search criteria'
              : 'Start typing to load results'
          }
          autoComplete
          includeInputInList
          disableClearable
          value={null as unknown as undefined}
          isOptionEqualToValue={(option, value) => value.code === option.code}
          loading={isSearching}
          onChange={(_e: unknown, data: CPTCodeDTO | null) => {
            updateState((state) => {
              if (data != null) {
                state.cptCodes = [...(state.cptCodes ?? []), data];
              }
            });
          }}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="CPT code"
              placeholder="Search CPT code"
              onChange={(e) => debouncedHandleInputChange(e.target.value)}
            />
          )}
          disabled={isReadOnly}
        />
        <ActionsList
          data={state.cptCodes ?? []}
          getKey={(value, index) => value.resourceId || index}
          renderItem={(value) => (
            <Typography>
              {value.code} {value.display}
            </Typography>
          )}
          renderActions={(value) =>
            !isReadOnly ? (
              <DeleteIconButton
                onClick={() =>
                  updateState(
                    (state) => (state.cptCodes = state.cptCodes?.filter((cptCode) => cptCode.code != value.code))
                  )
                }
              />
            ) : undefined
          }
          divider
        />
      </>
    );
  };

  const diagnosesWidget = (): ReactElement => {
    return (
      <>
        <DiagnosesField
          label="Dx"
          onChange={(value: IcdSearchResponse['codes'][number]): void => {
            const preparedValue = { ...value, isPrimary: false };
            updateState((state) => {
              state.diagnoses = [...(state.diagnoses ?? []), preparedValue];
            });
          }}
          disableForPrimary={false}
          disabled={isReadOnly}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ActionsList
            data={state.diagnoses ?? []}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => (
              <Typography>
                {value.display} {value.code}
              </Typography>
            )}
            renderActions={(value) =>
              !isReadOnly ? (
                <DeleteIconButton
                  onClick={() =>
                    updateState(
                      (state) =>
                        (state.diagnoses = state.diagnoses?.filter((diagnosis) => diagnosis.code != value.code))
                    )
                  }
                />
              ) : undefined
            }
            divider
          />
        </Box>
      </>
    );
  };

  const dropdown = (
    label: string,
    options: string[],
    value: string | undefined,
    stateMutator: (value: string, state: PageState) => void
  ): ReactElement => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={isReadOnly}>
        <InputLabel id={label}>{label}</InputLabel>
        <Select
          label={label}
          labelId={label}
          variant="outlined"
          value={value ?? ''}
          onChange={(e) => updateState((state) => stateMutator(e.target.value, state))}
        >
          {options.map((option) => {
            return (
              <MenuItem key={option} value={option}>
                <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                  {option}
                </Typography>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    );
  };

  const otherTextInput = (
    parentLabel: string,
    parentValue: string | undefined,
    value: string | undefined,
    stateMutator: (value: string, state: PageState) => void
  ): ReactElement => {
    if (parentValue !== 'Other') {
      return <></>;
    }
    return (
      <TextField
        label={'Other ' + parentLabel.toLocaleLowerCase()}
        size="small"
        value={value ?? ''}
        onChange={(e: any) => updateState((state) => stateMutator(e.target.value, state))}
        disabled={isReadOnly}
      />
    );
  };

  const radio = (
    label: string,
    options: string[],
    value: string | undefined,
    stateMutator: (value: string, state: PageState) => void,
    error = false
  ): ReactElement => {
    return (
      <FormControl error={error} disabled={isReadOnly}>
        <FormLabel id={label}>{label}</FormLabel>
        <RadioGroup
          row
          aria-labelledby={label}
          onChange={(e) => updateState((state) => stateMutator(e.target.value, state))}
          value={value ?? ''}
        >
          {options.map((option) => {
            return <FormControlLabel key={option} value={option} control={<Radio />} label={option} />;
          })}
        </RadioGroup>
        {error ? <FormHelperText>{REQUIRED_FIELD_ERROR_MESSAGE}</FormHelperText> : undefined}
      </FormControl>
    );
  };

  return (
    <>
      <Stack spacing={1}>
        <PageTitle label="Document Procedure" showIntakeNotesButton={false} />
        <AccordionCard>
          <Stack spacing={2} style={{ padding: '24px' }}>
            <Box style={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={state.consentObtained ?? false}
                onChange={(_e: any, checked: boolean) => updateState((state) => (state.consentObtained = checked))}
                disabled={isReadOnly}
              />
              <Typography>I have obtained the Consent for Procedure</Typography>
            </Box>
            <Typography style={{ marginTop: '16px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Procedure Type & CPT Code
            </Typography>
            {dropdown('Procedure type', PROCEDURE_TYPES, state.procedureType, (value, state) => {
              state.procedureType = value;
              if (PRE_POPULATED_CPT_CODE[value] != null) {
                state.cptCodes = [PRE_POPULATED_CPT_CODE[value]];
              }
            })}
            {cptWidget()}
            <Typography style={{ marginTop: '8px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Dx
            </Typography>
            {diagnosesWidget()}
            <Typography style={{ marginTop: '8px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Procedure Details
            </Typography>
            <Stack direction="row" spacing={2}>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <DatePicker
                  label="Date of the procedure"
                  slotProps={{
                    textField: {
                      InputLabelProps: { shrink: true },
                      InputProps: { size: 'small', placeholder: 'MM/DD/YYYY' },
                    },
                  }}
                  value={state.procedureDate}
                  onChange={(date: DateTime | null, _e: any) => updateState((state) => (state.procedureDate = date))}
                  disabled={isReadOnly}
                />
              </LocalizationProvider>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <TimePicker
                  label="Time of the procedure"
                  slotProps={{
                    textField: {
                      InputLabelProps: { shrink: true },
                      InputProps: { size: 'small' },
                    },
                  }}
                  value={state.procedureTime}
                  onChange={(time: DateTime | null, _e: any) => updateState((state) => (state.procedureTime = time))}
                  disabled={isReadOnly}
                />
              </LocalizationProvider>
            </Stack>
            {radio('Performed by', PERFORMED_BY, state.performerType, (value, state) => (state.performerType = value))}
            <InfoAlert text="Please include body part including laterality, type and quantity anesthesia used, specific materials (type and quantity) used, technique, findings, complications, specimen sent, and after-procedure status." />
            {dropdown(
              'Anaesthesia / medication used',
              MEDICATIONS_USED,
              state.medicationUsed,
              (value, state) => (state.medicationUsed = value)
            )}
            {dropdown('Site/location', SITES, state.bodySite, (value, state) => {
              state.bodySite = value;
              state.otherBodySite = undefined;
            })}
            {otherTextInput(
              'Site/location',
              state.bodySite,
              state.otherBodySite,
              (value, state) => (state.otherBodySite = value)
            )}
            {dropdown('Side of body', SIDES_OF_BODY, state.bodySide, (value, state) => (state.bodySide = value))}
            {dropdown('Technique', TECHNIQUES, state.technique, (value, state) => (state.technique = value))}
            {dropdown('Instruments / supplies used', SUPPLIES, state.suppliesUsed, (value, state) => {
              state.suppliesUsed = value;
              state.otherSuppliesUsed = undefined;
            })}
            {otherTextInput(
              'Instruments / supplies used',
              state.suppliesUsed,
              state.otherSuppliesUsed,
              (value, state) => (state.otherSuppliesUsed = value)
            )}
            <TextField
              label="Procedure details"
              multiline
              rows={4}
              value={state.procedureDetails ?? ''}
              onChange={(e: any) => updateState((state) => (state.procedureDetails = e.target.value))}
              disabled={isReadOnly}
            />
            {radio(
              'Specimen sent',
              SPECIMEN_SENT,
              state.specimenSent != null ? (state.specimenSent ? 'Yes' : 'No') : undefined,
              (value, state) => (state.specimenSent = value === 'Yes')
            )}
            {dropdown('Complications', COMPLICATIONS, state.complications, (value, state) => {
              state.complications = value;
              state.otherComplications = undefined;
            })}
            {otherTextInput(
              'Complications',
              state.complications,
              state.otherComplications,
              (value, state) => (state.otherComplications = value)
            )}
            {dropdown(
              'Patient response',
              PATIENT_RESPONSES,
              state.patientResponse,
              (value, state) => (state.patientResponse = value)
            )}
            {dropdown(
              'Post-procedure Instructions',
              POST_PROCEDURE_INSTRUCTIONS,
              state.postInstructions,
              (value, state) => {
                state.postInstructions = value;
                state.otherPostInstructions = undefined;
              }
            )}
            {otherTextInput(
              'Post-procedure Instructions',
              state.postInstructions,
              state.otherPostInstructions,
              (value, state) => (state.otherPostInstructions = value)
            )}
            {dropdown('Time spent', TIME_SPENT, state.timeSpent, (value, state) => (state.timeSpent = value))}
            {radio('Documented by', DOCUMENTED_BY, state.documentedBy, (value, state) => (state.documentedBy = value))}
            <Divider orientation="horizontal" />
            <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
              <RoundedButton color="primary" onClick={onCancel}>
                Cancel
              </RoundedButton>
              <RoundedButton color="primary" variant="contained" disabled={isReadOnly} onClick={onSave}>
                Save
              </RoundedButton>
            </Box>
          </Stack>
        </AccordionCard>
      </Stack>
      <Backdrop sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })} open={saveInProgress}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </>
  );
}

function getValueForOtherable(value: string | undefined, predefinedValues: string[]): string | undefined {
  if (value != null && predefinedValues.includes(value)) {
    return value;
  }
  return value != null ? OTHER : undefined;
}

function getOtherValueForOtherable(value: string | undefined, predefinedValues: string[]): string | undefined {
  if (value != null && !predefinedValues.includes(value)) {
    return value;
  }
  return undefined;
}
