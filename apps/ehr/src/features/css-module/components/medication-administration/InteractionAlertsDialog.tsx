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
import React, { ReactElement, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { MedicationInteractions } from 'utils';

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
  interactions: MedicationInteractions;
  onCancel: () => void;
  onContinue: (interactions: MedicationInteractions) => void;
}

const SEVERITY_ORDER = ['high', 'moderate', 'low'];

const SEVERITY_TO_LABEL = {
  high: 'Severe',
  moderate: 'Moderate',
  low: 'Minor',
  unknown: 'Unknown',
};

export const InteractionAlertsDialog: React.FC<Props> = (props) => {
  const [interactions, setInteractions] = useState<MedicationInteractions>(structuredClone(props.interactions));

  const allReasonsValid: boolean = [
    ...(interactions.drugInteractions ?? []),
    ...(interactions.allergyInteractions ?? []),
  ].reduce((acc, val) => {
    return acc && (val.overrideReason ?? '').trim().length > 0;
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
        style={{ background: otherColors.lightErrorBg, marginTop: '16px', padding: '16px', borderRadius: '4px' }}
        display="flex"
        alignItems="center"
      >
        <Typography variant="body2" style={{ color: otherColors.lightErrorText }}>
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
    if (value != null && !OVERRIDE_REASON.includes(value)) {
      value = OTHER;
    }
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
    value: string | undefined,
    onChange: (newValue: string) => void
  ): ReactElement | undefined => {
    if (value == null || OVERRIDE_REASON.includes(value)) {
      return undefined;
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

  const severityWidget = (severity: 'high' | 'moderate' | 'low' | undefined): ReactElement => {
    const order = SEVERITY_ORDER.indexOf(severity ?? '');
    return (
      <Stack direction="row" spacing="2px" display="flex" alignItems="center">
        {order < 3 ? redCicrcle() : emptyCicrcle()}
        {order < 2 ? redCicrcle() : emptyCicrcle()}
        {order < 1 ? redCicrcle() : emptyCicrcle()}
        <Typography style={{ marginLeft: '8px' }}>{SEVERITY_TO_LABEL[severity ?? 'unknown']}</Typography>
      </Stack>
    );
  };

  const renderSource = (source: string | undefined): ReactElement | undefined => {
    if (!source) {
      return <>Unknown</>;
    }
    const lines = source.split('\n');
    return (
      <Stack>
        <Typography variant="body2">{lines[0]}</Typography>
        <Typography color="secondary.light" variant="body2">
          {lines[1]}
        </Typography>
        <Typography color="secondary.light" variant="body2">
          {lines[2]}
        </Typography>
      </Stack>
    );
  };

  const medicationsInteractions = (): ReactElement | undefined => {
    if (interactions.drugInteractions == null || interactions.drugInteractions.length === 0) {
      return undefined;
    }
    return (
      <Stack>
        {interactionTypeTitle('Drug Interaction')}
        {interactionSubtitleBox(
          `According to the patient medication history, ordering “${props.medicationName}” may result in drug-drug interaction.`
        )}
        <Table style={{ border: '1px solid #DFE5E9', marginTop: '16px' }}>
          <TableHead>
            <TableRow>
              <TableCell width="15%">Ordered</TableCell>
              <TableCell width="15%">Interaction</TableCell>
              <TableCell width="20%">Source</TableCell>
              <TableCell width="25%">Interaction Description</TableCell>
              <TableCell width="25%">Override reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {interactions.drugInteractions
              .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity ?? '') - SEVERITY_ORDER.indexOf(b.severity ?? ''))
              .map((interaction, index) => {
                return (
                  <>
                    {index === 0 ? (
                      <TableRow key={interaction.severity}>
                        <TableCell colSpan={5} style={{ padding: '8px' }}>
                          {severityWidget(interaction.severity)}
                        </TableCell>
                      </TableRow>
                    ) : undefined}
                    <TableRow key={index}>
                      <TableCell>{props.medicationName}</TableCell>
                      <TableCell>{interaction.drugs.map((drug) => drug.name).join(', ')}</TableCell>
                      <TableCell>{renderSource(interaction.source?.display)}</TableCell>
                      <TableCell style={{ verticalAlign: 'top' }}>{interaction.message}</TableCell>
                      <TableCell>
                        {overrideReasonDropdown(
                          interaction.overrideReason,
                          'medication-' + index,
                          (newValue: string) => {
                            if (newValue !== OTHER) {
                              interaction.overrideReason = newValue;
                            } else {
                              interaction.overrideReason = '';
                            }
                            setInteractions({ ...interactions });
                          }
                        )}
                        {otherTextInput(interaction.overrideReason, (newValue: string) => {
                          interaction.overrideReason = newValue;
                          setInteractions({ ...interactions });
                        })}
                      </TableCell>
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>
      </Stack>
    );
  };

  const allergiesInteractions = (): ReactElement | undefined => {
    if (interactions.allergyInteractions == null || interactions.allergyInteractions.length === 0) {
      return undefined;
    }
    return (
      <Stack>
        {interactionTypeTitle('Allergy Interaction')}
        {interactionSubtitleBox(
          `According to the patient's reported allergy, ordering “${props.medicationName}” may result in an allergic reaction.`
        )}
        <Table style={{ border: '1px solid #DFE5E9', marginTop: '16px' }}>
          <TableHead>
            <TableRow>
              <TableCell width="70%">Allergy Description</TableCell>
              <TableCell width="30%">Override reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {interactions.allergyInteractions.map((interaction, index) => {
              return (
                <TableRow key={index}>
                  <TableCell style={{ verticalAlign: 'top' }}>{interaction.message}</TableCell>
                  <TableCell>
                    {overrideReasonDropdown(interaction.overrideReason, 'allergy-' + index, (newValue: string) => {
                      if (newValue !== OTHER) {
                        interaction.overrideReason = newValue;
                      } else {
                        interaction.overrideReason = '';
                      }
                      setInteractions({ ...interactions });
                    })}
                    {otherTextInput(interaction.overrideReason, (newValue: string) => {
                      interaction.overrideReason = newValue;
                      setInteractions({ ...interactions });
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
          <RoundedButton variant="outlined" onClick={props.onCancel}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" onClick={() => props.onContinue(interactions)} disabled={!allReasonsValid}>
            Continue
          </RoundedButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
