import React, { ReactElement } from 'react';
import { Dialog, DialogContent, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import { ErxCheckPrecheckInteractionsResponse } from '@oystehr/sdk';
import { Box, Stack } from '@mui/system';
import { otherColors } from '@ehrTheme/colors';
import { RoundedButton } from 'src/components/RoundedButton';

interface Props {
  medicationName: string;
  interactions: ErxCheckPrecheckInteractionsResponse;
  onCancel: () => void;
}

export const InteractionAlertsDialog: React.FC<Props> = ({ medicationName, interactions, onCancel }) => {
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
              <TableCell>Ordered</TableCell>
              <TableCell>Interaction</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Interaction Description</TableCell>
              <TableCell>Override reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {interactions.medications.map((medication, index) => {
              return (
                <TableRow key={index}>
                  <TableCell>todo</TableCell>
                  <TableCell>todo</TableCell>
                  <TableCell>todo</TableCell>
                  <TableCell>{medication.severityLevel}</TableCell>
                  <TableCell>{medication.message}</TableCell>
                  <TableCell>todo</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Stack>
    );
  };

  const allergiesInteractions = (): ReactElement | undefined => {
    if (interactions.allergies.length === 0) {
      return undefined;
    }
    return (
      <Stack>
        {interactionTypeTitle('Allergy Interaction')}
        {interactionSubtitleBox(
          `According to the patient's reported allergy to “[allergen name]”, ordering “${medicationName}” may result in an allergic reaction. `
        )}
        <Table style={{ border: '1px solid #DFE5E9', marginTop: '16px' }}>
          <TableHead>
            <TableRow>
              <TableCell>Patient Allergy</TableCell>
              <TableCell>Reaction</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Allergy Description</TableCell>
              <TableCell>Override reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {interactions.allergies.map((allergy, index) => {
              return (
                <TableRow key={index}>
                  <TableCell>{allergy.message}</TableCell>
                  <TableCell>todo</TableCell>
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
          <RoundedButton variant="contained">Continue</RoundedButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
