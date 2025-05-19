import { ReactElement, useState } from 'react';
import { PageTitle } from 'src/telemed/components/PageTitle';
import {
  AccordionCard,
  ActionsList,
  DeleteIconButton,
  useAppointmentStore,
  useDebounce,
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
  ChartDataWithResources,
  CPTCodeDTO,
  DiagnosisDTO,
  getSelectors,
  IcdSearchResponse,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import { DiagnosesField } from 'src/telemed/features/appointment/AssessmentTab';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTER_PATH } from '../routing/routesCSS';
import { InfoAlert } from '../components/InfoAlert';
import { enqueueSnackbar } from 'notistack';
import { DateTime } from 'luxon';

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
];
const PERFORMED_BY = ['Clinical support staff', 'Provider', 'Both'];
const MEDICATIONS_USED = ['None', 'Topical', 'Local', 'Oral', 'IV', 'IM'];
const SITES = ['Head', 'Face', 'Arm', 'Leg', 'Torso', 'Genital', 'Ear', 'Nose', 'Eye', 'Other'];
const SIDES_OF_BODY = ['Left', 'Right', 'Midline', 'Not Applicable'];
const TECHNIQUES = ['Sterile', 'Clean', 'Aseptic', 'Field'];
const SUPPLIES = ['Suture Kit', 'Splint', 'Irrigation Syringe', 'Speculum', 'Forceps', 'IV Kit', 'Other'];
const SPECIMEN_SENT = ['Yes', 'No'];
const COMPLICATIONS = ['None', 'Bleeding', 'Incomplete Removal', 'Allergic Reaction', 'Other'];
const PATIENT_RESPONSES = ['Tolerated Well', 'Mild Distress', 'Severe Distress', 'Improved', 'Stable', 'Worsened'];
const POST_PROCEDURE_INSTRUCTIONS = ['Wound Care', 'F/U with PCP', 'Return if worsening', 'Other'];
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
  const { id: appointmentId } = useParams();
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const chartCptCodes = chartData?.cptCodes || [];
  const chartDiagnoses = chartData?.diagnosis || [];
  const chartProcedures = chartData?.procedures || [];
  const { mutate: saveChartData } = useSaveChartData();
  const [state, setState] = useState<PageState>({
    procedureDate: DateTime.now(),
    procedureTime: DateTime.now(),
  });
  const [saveInProgress, setSaveInProgress] = useState<boolean>(false);

  const updateState = (stateMutator: (state: PageState) => void): void => {
    stateMutator(state);
    setState({ ...state });
  };

  const onCancel = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
  };

  const saveCptAndDiagnoses = (cptCodes: CPTCodeDTO[], diagnoses: DiagnosisDTO[]): Promise<ChartDataWithResources> => {
    return new Promise<ChartDataWithResources>((resolve, reject) => {
      saveChartData(
        {
          cptCodes: cptCodes,
          diagnosis: diagnoses,
        },
        {
          onSuccess: resolve,
          onError: reject,
        }
      );
    });
  };

  const onSave = async (): Promise<void> => {
    setSaveInProgress(true);
    const cptAndDiagnosesResponse = await saveCptAndDiagnoses(state.cptCodes ?? [], state.diagnoses ?? []);
    const savedCptCodes = cptAndDiagnosesResponse.chartData?.cptCodes;
    if (savedCptCodes) {
      setPartialChartData({
        cptCodes: [...chartCptCodes, ...savedCptCodes],
      });
    }
    const savedDiagnoses = cptAndDiagnosesResponse.chartData?.diagnosis;
    if (savedDiagnoses) {
      setPartialChartData({
        diagnosis: [...chartDiagnoses, ...savedDiagnoses],
      });
    }
    saveChartData(
      {
        procedures: [
          {
            procedureType: state.procedureType,
            cptCodes: savedCptCodes,
            diagnoses: savedDiagnoses,
            procedureDateTime: state.procedureDate
              ?.set({ hour: state.procedureTime?.hour, minute: state.procedureTime?.minute })
              ?.toUTC()
              ?.toString(),
            documentedDateTime: DateTime.now().toUTC().toString(),
            performerType: state.performerType,
            medicationUsed: state.medicationUsed,
            bodySite: state.bodySite,
            bodySide: state.bodySide,
            technique: state.technique,
            suppliesUsed: state.suppliesUsed,
            procedureDetails: state.procedureDetails,
            specimenSent: state.specimenSent,
            complications: state.complications,
            patientResponse: state.patientResponse,
            postInstructions: state.postInstructions,
            timeSpent: state.timeSpent,
            documentedBy: state.documentedBy,
          },
        ],
      },
      {
        onSuccess: (data) => {
          setSaveInProgress(false);
          const savedProcedure = data.chartData?.procedures?.[0];
          if (savedProcedure) {
            setPartialChartData({
              procedures: [
                ...chartProcedures,
                {
                  ...savedProcedure,
                  cptCodes: savedCptCodes ?? [],
                  diagnoses: savedDiagnoses ?? [],
                },
              ],
            });
          }
          enqueueSnackbar('Procedure saved!', { variant: 'success' });
          navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
        },
        onError: () => {
          setSaveInProgress(false);
          enqueueSnackbar('An error has occurred while saving procedure. Please try again.', { variant: 'error' });
        },
      }
    );
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
        />
        <ActionsList
          data={state.cptCodes ?? []}
          getKey={(value, index) => value.resourceId || index}
          renderItem={(value) => (
            <Typography>
              {value.code} {value.display}
            </Typography>
          )}
          renderActions={(value) => (
            <DeleteIconButton
              onClick={() =>
                updateState(
                  (state) => (state.cptCodes = state.cptCodes?.filter((cptCode) => cptCode.code != value.code))
                )
              }
            />
          )}
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
            renderActions={(value) => (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <DeleteIconButton
                  onClick={() =>
                    updateState(
                      (state) =>
                        (state.diagnoses = state.diagnoses?.filter((diagnosis) => diagnosis.code != value.code))
                    )
                  }
                />
              </Box>
            )}
            divider
          />
        </Box>
      </>
    );
  };

  const dropdown = (
    label: string,
    options: string[],
    stateMutator: (value: string, state: PageState) => void
  ): ReactElement => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small">
        <InputLabel id={label}>{label}</InputLabel>
        <Select
          label={label}
          labelId={label}
          variant="outlined"
          defaultValue=""
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
    stateMutator: (value: string, state: PageState) => void
  ): ReactElement => {
    if (parentValue !== 'Other') {
      return <></>;
    }
    return (
      <TextField
        label={'Other ' + parentLabel.toLocaleLowerCase()}
        size="small"
        onChange={(e: any) => updateState((state) => stateMutator(e.target.value, state))}
      />
    );
  };

  const radio = (
    label: string,
    options: string[],
    stateMutator: (value: string, state: PageState) => void,
    error = false
  ): ReactElement => {
    return (
      <FormControl error={error}>
        <FormLabel id={label}>{label}</FormLabel>
        <RadioGroup
          row
          aria-labelledby={label}
          onChange={(e) => updateState((state) => stateMutator(e.target.value, state))}
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
                onChange={(_e: any, checked: boolean) => updateState((state) => (state.consentObtained = checked))}
              />
              <Typography>I have obtained the Consent for Procedure *</Typography>
            </Box>
            <InfoAlert
              text="Please include body part including laterality, type and quantity of anesthesia used, specific materials (type
              and quantity) used, technique, findings, complications, specimen sent, and after-procedure status."
            />
            <Typography style={{ marginTop: '16px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Procedure Type & CPT Code
            </Typography>
            {dropdown('Procedure type', PROCEDURE_TYPES, (value, state) => (state.procedureType = value))}
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
                />
              </LocalizationProvider>
            </Stack>
            {radio('Performed by', PERFORMED_BY, (value, state) => (state.performerType = value))}
            {dropdown(
              'Anaesthesia / medication used',
              MEDICATIONS_USED,
              (value, state) => (state.medicationUsed = value)
            )}
            {dropdown('Site/location', SITES, (value, state) => {
              state.bodySite = value;
              state.otherBodySite = undefined;
            })}
            {otherTextInput('Site/location', state.bodySite, (value, state) => (state.otherBodySite = value))}
            {dropdown('Side of body', SIDES_OF_BODY, (value, state) => (state.bodySide = value))}
            {dropdown('Technique', TECHNIQUES, (value, state) => (state.technique = value))}
            {dropdown('Instruments / supplies used', SUPPLIES, (value, state) => {
              state.suppliesUsed = value;
              state.otherSuppliesUsed = undefined;
            })}
            {otherTextInput(
              'Instruments / supplies used',
              state.suppliesUsed,
              (value, state) => (state.otherSuppliesUsed = value)
            )}
            <TextField
              label="Procedure details"
              multiline
              rows={4}
              onChange={(e: any) => updateState((state) => (state.procedureDetails = e.target.value))}
            />
            {radio('Specimen sent', SPECIMEN_SENT, (value, state) => (state.specimenSent = value === 'Yes'))}
            {dropdown('Complications', COMPLICATIONS, (value, state) => {
              state.complications = value;
              state.otherComplications = undefined;
            })}
            {otherTextInput('Complications', state.complications, (value, state) => (state.otherComplications = value))}
            {dropdown('Patient response', PATIENT_RESPONSES, (value, state) => (state.patientResponse = value))}
            {dropdown('Post-procedure Instructions', POST_PROCEDURE_INSTRUCTIONS, (value, state) => {
              state.postInstructions = value;
              state.otherPostInstructions = undefined;
            })}
            {otherTextInput(
              'Post-procedure Instructions',
              state.postInstructions,
              (value, state) => (state.otherPostInstructions = value)
            )}
            {dropdown('Time spent', TIME_SPENT, (value, state) => (state.timeSpent = value))}
            {radio('Documented by', DOCUMENTED_BY, (value, state) => (state.documentedBy = value))}
            <Divider orientation="horizontal" />
            <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
              <RoundedButton color="primary" onClick={onCancel}>
                Cancel
              </RoundedButton>
              <RoundedButton color="primary" variant="contained" disabled={!state.consentObtained} onClick={onSave}>
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
