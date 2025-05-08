import { ReactElement, useState } from 'react';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { AccordionCard, ActionsList, DeleteIconButton, useDebounce, useGetIcd10Search } from 'src/telemed';
import { Box, Stack } from '@mui/system';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import {
  Autocomplete,
  Button,
  Checkbox,
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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { CPTCodeDTO, DiagnosisDTO, IcdSearchResponse, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { DiagnosesField } from 'src/telemed/features/appointment/AssessmentTab';

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

interface State {
  consentObtained?: boolean;
  procedureType?: string;
  procedureTypeError?: boolean;
  cptCodes?: CPTCodeDTO[];
  cptCodesError?: boolean;
  diagnoses?: DiagnosisDTO[];
  diagnosesError?: boolean;
  procedureDate?: string;
  procedureDateError?: boolean;
  procedureTime?: string;
  procedureTimeError?: boolean;
  performer?: string;
  performerError?: boolean;
  medicationUsed?: string;
  site?: string;
  otherSite?: string;
  bodySide?: string;
  technique?: string;
  suppliesUsed?: string;
  otherSuppliesUsed?: string;
  procedureDetails?: string;
  specimenSent?: string;
  complications?: string;
  otherComplications?: string;
  patientResponse?: string;
  postInstructions?: string;
  otherPostInstructions?: string;
  timeSpent?: string;
  documentedBy?: string;
}

export default function ProcedureNew(): ReactElement {
  const [state, setState] = useState<State>({});

  const updateState = (stateMutator: (state: State) => void): void => {
    stateMutator(state);
    setState({ ...state });
  };

  const onSave = (): void => {
    if (isNullOrEmpty(state.procedureType)) {
      state.procedureTypeError = true;
    }
    if (state.cptCodes == null || state.cptCodes.length === 0) {
      state.cptCodesError = true;
    }
    if (state.diagnoses == null || state.diagnoses.length === 0) {
      state.diagnosesError = true;
    }
    if (isNullOrEmpty(state.procedureDate)) {
      state.procedureDateError = true;
    }
    if (isNullOrEmpty(state.procedureTime)) {
      state.procedureTimeError = true;
    }
    if (isNullOrEmpty(state.performer)) {
      state.performerError = true;
    }
    setState({ ...state });
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
                state.cptCodesError = false;
              }
            });
          }}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="CPT code *"
              placeholder="Search CPT code"
              onChange={(e) => debouncedHandleInputChange(e.target.value)}
              error={state.cptCodesError}
              helperText={state.cptCodesError ? REQUIRED_FIELD_ERROR_MESSAGE : undefined}
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
        />
      </>
    );
  };

  const diagnosesWidget = (): ReactElement => {
    return (
      <>
        <DiagnosesField
          label="Dx *"
          onChange={(value: IcdSearchResponse['codes'][number]): void => {
            const preparedValue = { ...value, isPrimary: false };
            updateState((state) => {
              state.diagnoses = [...(state.diagnoses ?? []), preparedValue];
              state.diagnosesError = false;
            });
          }}
          error={state.diagnosesError ? { type: 'required', message: REQUIRED_FIELD_ERROR_MESSAGE } : undefined}
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
    stateMutator: (value: string, state: State) => void,
    error = false
  ): ReactElement => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" error={error}>
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
        {error ? <FormHelperText>{REQUIRED_FIELD_ERROR_MESSAGE}</FormHelperText> : undefined}
      </FormControl>
    );
  };

  const otherTextInput = (
    parentLabel: string,
    parentValue: string | undefined,
    stateMutator: (value: string, state: State) => void
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
    stateMutator: (value: string, state: State) => void,
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
      <PageTitle label="Document Procedure" showIntakeNotesButton={false} />
      <AccordionCard>
        <Stack spacing={2} style={{ padding: '24px' }}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <Checkbox
              onChange={(_e: any, checked: boolean) => updateState((state) => (state.consentObtained = checked))}
            />
            <Typography>I have obtained the Consent for Procedure*</Typography>
          </Box>
          <Box style={{ display: 'flex', background: '#E5F3FA', padding: '12px', borderRadius: '4px' }}>
            <InfoOutlinedIcon
              style={{
                height: '22px',
                width: '22px',
                marginRight: '12px',
                color: '#0288D1',
              }}
            />
            <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
              Please include body part including laterality, type and quantity anesthesia used, specific materials (type
              and quantity) used, technique, findings, complications, specimen sent, and after-procedure status.
            </Typography>
          </Box>
          {dropdown(
            'Procedure type *',
            PROCEDURE_TYPES,
            (value, state) => {
              state.procedureType = value;
              state.procedureTypeError = false;
            },
            state.procedureTypeError
          )}
          {cptWidget()}
          {diagnosesWidget()}
          <Stack direction="row" spacing={2}>
            <LocalizationProvider dateAdapter={AdapterLuxon}>
              <DatePicker
                label="Date of the procedure *"
                slotProps={{
                  textField: {
                    InputLabelProps: { shrink: true },
                    InputProps: { size: 'small', placeholder: 'MM/DD/YYYY' },
                    helperText: state.procedureDateError ? REQUIRED_FIELD_ERROR_MESSAGE : undefined,
                    error: state.procedureDateError,
                  },
                }}
                onChange={(e: any) => updateState((state) => (state.procedureDate = e.target.value))}
              />
            </LocalizationProvider>
            <LocalizationProvider dateAdapter={AdapterLuxon}>
              <TimePicker
                label="Time of the procedure *"
                slotProps={{
                  textField: {
                    InputLabelProps: { shrink: true },
                    InputProps: { size: 'small' },
                    helperText: state.procedureTimeError ? REQUIRED_FIELD_ERROR_MESSAGE : undefined,
                    error: state.procedureTimeError,
                  },
                }}
                onChange={(e: any) => updateState((state) => (state.procedureTime = e.target.value))}
              />
            </LocalizationProvider>
          </Stack>
          {(radio('Performed by *', PERFORMED_BY, (value, state) => (state.performer = value)), state.performerError)}
          {dropdown(
            'Anaesthesia / medication used',
            MEDICATIONS_USED,
            (value, state) => (state.medicationUsed = value)
          )}
          {dropdown('Site/location', SITES, (value, state) => {
            state.site = value;
            state.otherSite = undefined;
          })}
          {otherTextInput('Site/location', state.site, (value, state) => (state.otherSite = value))}
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
          {radio('Specimen sent', SPECIMEN_SENT, (value, state) => (state.specimenSent = value))}
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
            <RoundedButton color="primary">Cancel</RoundedButton>
            <RoundedButton color="primary" variant="contained" disabled={!state.consentObtained} onClick={onSave}>
              Save
            </RoundedButton>
          </Box>
        </Stack>
      </AccordionCard>
    </>
  );
}

function isNullOrEmpty(str: string | undefined): boolean {
  return str == null || str === '';
}
