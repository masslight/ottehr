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
import { INTERACTION_OVERRIDE_REASON_CODE_SYSTEM, MEDICATION_DISPENSABLE_DRUG_ID } from 'utils';

const ACT_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';

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
  onResolve: (issues: DetectedIssue[]) => void;
}

interface State {
  medications: {
    drugs: {
      id: string;
      name: string;
    }[];
    severity: Severity;
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

enum Severity {
  SEVERE = 'Severe',
  MODERATE = 'Moderate',
  MINOR = 'Minor',
  UNKNOWN = 'Unknown',
}

const SEVERITY_ORDER = [Severity.SEVERE, Severity.MODERATE, Severity.MINOR, Severity.UNKNOWN];

const SEVERITY_TO_LABEL = {
  MajorInteraction: Severity.SEVERE,
  ModerateInteraction: Severity.MODERATE,
  MinorInteraction: Severity.MINOR,
  Unknown: Severity.UNKNOWN,
};

const SEVERITY_TO_FHIR_SEVERITY: any = {
  Severe: 'high',
  Moderate: 'moderate',
  Minor: 'low',
  Unknown: undefined,
};

export const InteractionAlertsDialog: React.FC<Props> = ({ medicationName, interactions, onCancel, onResolve }) => {
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

  const severityWidget = (severity: Severity): ReactElement => {
    const order = SEVERITY_ORDER.indexOf(severity);
    return (
      <Stack direction="row" spacing="2px" display="flex" alignItems="center">
        {order < 3 ? redCicrcle() : emptyCicrcle()}
        {order < 2 ? redCicrcle() : emptyCicrcle()}
        {order < 1 ? redCicrcle() : emptyCicrcle()}
        <Typography style={{ marginLeft: '8px' }}>{severity}</Typography>
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
              <TableCell width="20%">Interaction Description</TableCell>
              <TableCell width="30%">Override reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.medications.map((medication, index) => {
              return (
                <>
                  {index === 0 || state.medications[index - 1].severity != medication.severity ? (
                    <TableRow key={medication.severity}>
                      <TableCell colSpan={5} style={{ padding: '8px' }}>
                        {severityWidget(medication.severity)}
                      </TableCell>
                    </TableRow>
                  ) : undefined}
                  <TableRow key={index}>
                    <TableCell>todo</TableCell>
                    <TableCell>{medication.drugs.map((drug) => drug.name).join(', ')}</TableCell>
                    <TableCell>todo</TableCell>
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
                </>
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

  const onContinueClick = (): void => {
    const drugIssues: DetectedIssue[] = state.medications.map((medication) => {
      const overrideReason = medication.otherOverrideReason ?? medication.overrideReason;
      return {
        resourceType: 'DetectedIssue',
        status: 'registered',
        code: {
          coding: [
            {
              system: ACT_CODE_SYSTEM,
              code: 'DRG',
            },
          ],
        },
        severity: SEVERITY_TO_FHIR_SEVERITY[medication.severity],
        detail: medication.message,
        mitigation: [
          {
            action: {
              coding: [
                {
                  system: INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
                  code: overrideReason,
                  display: overrideReason,
                },
              ],
            },
          },
        ],
        evidence: medication.drugs.map((drug) => {
          return {
            code: [
              {
                coding: [
                  {
                    system: MEDICATION_DISPENSABLE_DRUG_ID,
                    code: drug.id,
                  },
                ],
              },
            ],
          };
        }),
      };
    });
    const allergyIssues: DetectedIssue[] = state.allergies.map((allergy) => {
      const overrideReason = allergy.otherOverrideReason ?? allergy.overrideReason;
      return {
        resourceType: 'DetectedIssue',
        status: 'registered',
        code: {
          coding: [
            {
              system: ACT_CODE_SYSTEM,
              code: 'ALGY',
            },
          ],
        },
        detail: allergy.message,
        mitigation: [
          {
            action: {
              coding: [
                {
                  system: INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
                  code: overrideReason,
                  display: overrideReason,
                },
              ],
            },
          },
        ],
      };
    });
    onResolve([...drugIssues, ...allergyIssues]);
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
          <RoundedButton variant="contained" onClick={onContinueClick} disabled={!allReasonsValid}>
            Continue
          </RoundedButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

function initialStateFromInteractions(interactions: ErxCheckPrecheckInteractionsResponse): State {
  return {
    medications: interactions.medications
      .map((medication) => ({
        drugs: (medication.medications ?? []).map((nestedMedication) => ({
          id: nestedMedication.id.toString(),
          name: nestedMedication.name,
        })),
        severity: SEVERITY_TO_LABEL[medication.severityLevel],
        message: medication.message,
      }))
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)),
    allergies: interactions.allergies.map((allergy) => ({
      message: allergy.message,
    })),
  };
}
