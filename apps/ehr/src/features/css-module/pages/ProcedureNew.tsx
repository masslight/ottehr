import { ReactElement, useState } from 'react';
import PageContainer from '../../../layout/PageContainer';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { AccordionCard } from 'src/telemed';
import { Box, Stack } from '@mui/system';
import {
  Checkbox,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { RoundedButton } from 'src/components/RoundedButton';

type ConsentField = 'patient-signature' | 'patient-name' | 'procedure-type';
const REQUIRED_FIELD_ERROR = 'This field is required';
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

interface State {
  consent: {
    obtained?: boolean;
    patientSignature?: string;
    patientName?: string;
    procedureType?: string;
    finished?: boolean;
    errorFields?: ConsentField[];
  };
  procedureDetails: {
    cptCode?: string;
    dxCode?: string;
    date?: string;
    time?: string;
    performer?: 'provider' | 'staff' | 'both';
    medicationUsed?: string;
    site?: string;
    otherSite?: string;
    bodySide?: string;
    technique?: string;
    suppliesUsed?: string;
    details?: string;
    specimenSent?: boolean;
    complications?: string;
    otherComplications?: string;
    patientResponse?: string;
    postInstructions?: string;
    otherPostInstructions?: string;
    timeSpent?: string;
    documentedBy?: 'provider' | 'staff';
  };
}

export default function ProcedureNew(): ReactElement {
  const [state, setState] = useState<State>({ consent: {}, procedureDetails: {} });

  const handleConsentObtained = (_e: any, checked: boolean): void => {
    const newState = state;
    newState.consent.obtained = checked;
    setState({ ...newState });
  };

  const handleConsentContinue = (): void => {
    const newErrorFields: ConsentField[] = [];
    if (isNullOrEmpty(state.consent.patientSignature)) {
      newErrorFields.push('patient-signature');
    }
    if (isNullOrEmpty(state.consent.patientName)) {
      newErrorFields.push('patient-name');
    }
    if (isNullOrEmpty(state.consent.procedureType)) {
      newErrorFields.push('procedure-type');
    }
    if (newErrorFields.length === 0) {
      state.consent.finished = true;
    } else {
      state.consent.errorFields = newErrorFields;
    }
    setState({ ...state });
  };

  const onPatientSignatureChanged = (newValue: string): void => {
    state.consent.patientSignature = newValue;
    state.consent.errorFields = state.consent.errorFields?.filter((field) => field != 'patient-signature');
    setState({ ...state });
  };

  const onPatientNameChanged = (newValue: string): void => {
    state.consent.patientName = newValue;
    state.consent.errorFields = state.consent.errorFields?.filter((field) => field != 'patient-name');
    setState({ ...state });
  };

  const onProcedureTypeChanged = (newValue: string): void => {
    state.consent.procedureType = newValue;
    state.consent.errorFields = state.consent.errorFields?.filter((field) => field != 'procedure-type');
    setState({ ...state });
  };

  const isError = (field: ConsentField): boolean => {
    return state.consent.errorFields?.includes(field) ?? false;
  };

  const helperText = (field: ConsentField): string | undefined => {
    return state.consent.errorFields?.includes(field) ? REQUIRED_FIELD_ERROR : undefined;
  };

  if (!state.consent.finished) {
    return (
      <>
        <PageTitle label="Document Procedure" showIntakeNotesButton={false} />
        <AccordionCard>
          <Stack spacing={2} style={{ padding: '24px' }}>
            <Box style={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox onChange={handleConsentObtained} />
              <Typography>I have obtained the Consent for Procedure*</Typography>
            </Box>
            <TextField
              label="Signature of patient/representative *"
              size="small"
              onChange={(e) => onPatientSignatureChanged(e.target.value)}
              error={isError('patient-signature')}
              helperText={helperText('patient-signature')}
            />
            <TextField
              label="Patient/representative name *"
              size="small"
              onChange={(e) => onPatientNameChanged(e.target.value)}
              error={isError('patient-name')}
              helperText={helperText('patient-name')}
            />
            <Divider orientation="horizontal" />
            <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" error={isError('procedure-type')}>
              <InputLabel id="procedure-type-label">Procedure type *</InputLabel>
              <Select
                label="Procedure type *"
                labelId="procedure-type-label"
                variant="outlined"
                defaultValue=""
                onChange={(e) => onProcedureTypeChanged(e.target.value)}
              >
                {PROCEDURE_TYPES.map((type) => {
                  return (
                    <MenuItem key={type} value={type}>
                      <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                        {type}
                      </Typography>
                    </MenuItem>
                  );
                })}
              </Select>
              <FormHelperText>{helperText('procedure-type')}</FormHelperText>
            </FormControl>
            <Divider orientation="horizontal" />
            <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
              <RoundedButton color="primary">Cancel</RoundedButton>
              <RoundedButton
                color="primary"
                variant="contained"
                onClick={handleConsentContinue}
                disabled={!state.consent.obtained}
              >
                Continue
              </RoundedButton>
            </Box>
          </Stack>
        </AccordionCard>
      </>
    );
  }
  return (
    <PageContainer>
      <>Procedure: {state.consent?.procedureType} </>
    </PageContainer>
  );
}

function isNullOrEmpty(str: string | undefined): boolean {
  return str == null || str === '';
}
