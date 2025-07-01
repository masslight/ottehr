import { otherColors } from '@ehrTheme/colors';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import {
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Box, Stack } from '@mui/system';
import { ErxCheckPrecheckInteractionsResponse } from '@oystehr/sdk';
import { DetectedIssue } from 'fhir/r4b';
import React, { ReactElement, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';

const OTHER = 'Other';
const OVERRIDE_REASON = [
  'Will monitor or take precautions',
  'Not clinically significant',
  'Benefit Outweighs Risk',
  'Patient tolerated previously',
  'Dose adjusted',
  OTHER,
];

interface Props {
  medicationName: string;
  interactions: ErxCheckPrecheckInteractionsResponse;
  onCancel: () => void;
  onConfirm: (issues: DetectedIssue[]) => void;
}

interface State {
  medications: {
    drugId: string;
    name: string;
    severityLevel: 'MajorInteraction' | 'ModerateInteraction' | 'MinorInteraction' | 'Unknown';
    message: string;
    overrideReason?: string;
    otherOverrideReason?: string;
  }[];
  allergies: {
    message: string;
    overrideReason?: string;
    otherOverrideReason?: string;
  }[];
}

const SEVERITY_TO_LABEL = {
  MajorInteraction: 'Severe',
  ModerateInteraction: 'Moderate',
  MinorInteraction: 'Minor',
  Unknown: 'Unknown',
};

export const InteractionAlertsDialog: React.FC<Props> = ({ medicationName, interactions, onCancel }) => {
  const [state, setState] = useState<State>(initialStateFromInteractions(interactions));

  const allReasonsValid: boolean = [...state.medications, ...state.allergies].reduce((acc, val) => {
    return (
      acc &&
      val.overrideReason != null &&
      (val.overrideReason !== OTHER || (val.otherOverrideReason ?? '').trim().length > 0)
    );
  }, true);

  const interactionTypeTitle = (title: string): ReactElement => {
    return (
      <Stack direction="row" spacing="12px" alignItems="center" style={{ marginTop: '16px' }}>
        <Box
          style={{
            width: '19px',
            height: '19px',
            background: otherColors.priorityHighIcon,
            borderRadius: '4px',
            padding: '1px 2px 1px 2px',
          }}
        >
          <PriorityHighOutlinedIcon style={{ width: '15px', height: '15px', color: '#FFF' }} />
        </Box>
        <Typography style={{ fontSize: '18px', fontWeight: 600, color: otherColors.priorityHighIcon }}>
          {title}
        </Typography>
      </Stack>
    );
  };

  const interactionSubtitleBox = (text: string): ReactElement => {
    return (
      <Box
        style={{ background: '#FBEAEA', marginTop: '16px', padding: '16px', borderRadius: '4px' }}
        display="flex"
        alignItems="center"
      >
        <Typography variant="body2" style={{ color: '#541313' }}>
          {text}
        </Typography>
      </Box>
    );
  };

  const overrideReasonDropdown = (
    value: string | undefined,
    id: string,
    onChange: (newValue: string) => void
  ): ReactElement => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small">
        <InputLabel id={id}>Override reason</InputLabel>
        <Select
          label="Override reason"
          labelId={id}
          variant="outlined"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {OVERRIDE_REASON.map((reason) => {
            return (
              <MenuItem key={reason} value={reason}>
                <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                  {reason}
                </Typography>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    );
  };

  const otherTextInput = (
    parentValue: string | undefined,
    value: string | undefined,
    onChange: (newValue: string) => void
  ): ReactElement => {
    if (parentValue !== 'Other') {
      return <></>;
    }
    return (
      <TextField
        label="Please specify*"
        size="small"
        value={value ?? ''}
        fullWidth
        onChange={(e: any) => onChange(e.target.value)}
        style={{ marginTop: '8px' }}
      />
    );
  };

  const redCicrcle = (): ReactElement => {
    return (
      <Box
        style={{
          display: 'inline-block',
          width: '12px',
          height: '12px',
          border: '6px #F44336 solid',
          borderRadius: '6px',
        }}
      ></Box>
    );
  };

  const emptyCicrcle = (): ReactElement => {
    return (
      <Box
        style={{
          display: 'inline-block',
          width: '12px',
          height: '12px',
          border: '1px #DFE5E9 solid',
          borderRadius: '6px',
        }}
      ></Box>
    );
  };

  const severityWidget = (
    severity: 'MajorInteraction' | 'ModerateInteraction' | 'MinorInteraction' | 'Unknown'
  ): ReactElement => {
    return (
      <Stack direction="column">
        {SEVERITY_TO_LABEL[severity]}
        <Stack direction="row" spacing="2px">
          {severity === 'MajorInteraction' || severity === 'ModerateInteraction' || severity === 'MinorInteraction'
            ? redCicrcle()
            : emptyCicrcle()}
          {severity === 'MajorInteraction' || severity === 'ModerateInteraction' ? redCicrcle() : emptyCicrcle()}
          {severity === 'MajorInteraction' ? redCicrcle() : emptyCicrcle()}
        </Stack>
      </Stack>
    );
  };

  const medicationsInteractions = (): ReactElement | undefined => {
    if (interactions.medications.length === 0) {
      return undefined;
    }
    return (
      <Stack>
        {interactionTypeTitle('Drug Interaction')}
        {interactionSubtitleBox(
          `According to the patient medication history, ordering “${medicationName}” may result in drug-drug interaction.`
        )}
        <Table style={{ border: '1px solid #DFE5E9', marginTop: '16px' }}>
          <TableHead>
            <TableRow>
              <TableCell width="15%">Ordered</TableCell>
              <TableCell width="15%">Interaction</TableCell>
              <TableCell width="10%">Source</TableCell>
              <TableCell width="10%">Severity</TableCell>
              <TableCell width="20%">Interaction Description</TableCell>
              <TableCell width="30%">Override reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.medications.map((medication, index) => {
              return (
                <TableRow key={index}>
                  <TableCell>todo</TableCell>
                  <TableCell>todo</TableCell>
                  <TableCell>todo</TableCell>
                  <TableCell>{severityWidget(medication.severityLevel)}</TableCell>
                  <TableCell style={{ verticalAlign: 'top' }}>{medication.message}</TableCell>
                  <TableCell>
                    {overrideReasonDropdown(medication.overrideReason, 'medication-' + index, (newValue: string) => {
                      medication.overrideReason = newValue;
                      if (newValue != OTHER) {
                        medication.otherOverrideReason = undefined;
                      }
                      setState({ ...state });
                    })}
                    {otherTextInput(medication.overrideReason, medication.otherOverrideReason, (newValue: string) => {
                      medication.otherOverrideReason = newValue;
                      setState({ ...state });
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Stack>
    );
  };

  const allergiesInteractions = (): ReactElement | undefined => {
    if (state.allergies.length === 0) {
      return undefined;
    }
    return (
      <Stack>
        {interactionTypeTitle('Allergy Interaction')}
        {interactionSubtitleBox(
          `According to the patient's reported allergy, ordering “${medicationName}” may result in an allergic reaction.`
        )}
        <Table style={{ border: '1px solid #DFE5E9', marginTop: '16px' }}>
          <TableHead>
            <TableRow>
              <TableCell width="70%">Allergy Description</TableCell>
              <TableCell width="30%">Override reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.allergies.map((allergy, index) => {
              return (
                <TableRow key={index}>
                  <TableCell style={{ verticalAlign: 'top' }}>{allergy.message}</TableCell>
                  <TableCell>
                    {overrideReasonDropdown(allergy.overrideReason, 'allergy-' + index, (newValue: string) => {
                      allergy.overrideReason = newValue;
                      if (newValue != OTHER) {
                        allergy.otherOverrideReason = undefined;
                      }
                      setState({ ...state });
                    })}
                    {otherTextInput(allergy.overrideReason, allergy.otherOverrideReason, (newValue: string) => {
                      allergy.otherOverrideReason = newValue;
                      setState({ ...state });
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Stack>
    );
  };

  return (
    <Dialog open={true} maxWidth="lg" fullWidth>
      <DialogContent style={{ padding: '8px 24px 24px 24px' }}>
        {medicationsInteractions()}
        {allergiesInteractions()}
        <Box style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
          <RoundedButton variant="outlined" onClick={onCancel}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" disabled={!allReasonsValid}>
            Continue
          </RoundedButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

function initialStateFromInteractions(interactions: ErxCheckPrecheckInteractionsResponse): State {
  return {
    medications: interactions.medications.flatMap((medication) => {
      return medication.drugIds.map((drugId) => ({
        drugId: drugId.toString(),
        name: 'todo',
        severityLevel: medication.severityLevel,
        message: medication.message,
      }));
    }),
    allergies: interactions.allergies.map((allergy) => ({
      message: allergy.message,
    })),
  };
}
