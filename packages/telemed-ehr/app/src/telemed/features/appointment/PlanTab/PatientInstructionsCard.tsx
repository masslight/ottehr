import React, { FC, useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DoneIcon from '@mui/icons-material/Done';
import { CommunicationDTO } from 'ehr-utils';
import { AccordionCard, ActionsList, DeleteIconButton, RoundedButton } from '../../../components';
import { PatientInstructionsTemplatesDialog } from './components';
import { useAppointmentStore, useDeleteChartData, useSaveChartData, useSavePatientInstruction } from '../../../state';
import { getSelectors } from '../../../../shared/store/getSelectors';

export const PatientInstructionsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const [myTemplatesOpen, setMyTemplatesOpen] = useState(false);
  const [ottehrTemplatesOpen, setOttehrTemplatesOpen] = useState(false);

  const [instruction, setInstruction] = useState('');

  const { mutate: savePatientInstruction, isLoading: isSavePatientInstructionLoading } = useSavePatientInstruction();
  const { mutate: saveChartData, isLoading: isSaveChartDataLoading } = useSaveChartData();
  const { mutate: deleteChartData } = useDeleteChartData();

  const isLoading = isSavePatientInstructionLoading || isSaveChartDataLoading;

  const { chartData, setPartialChartData, isReadOnly } = getSelectors(useAppointmentStore, [
    'chartData',
    'setPartialChartData',
    'isReadOnly',
  ]);
  const instructions = chartData?.instructions || [];

  const onAddAndSave = (): void => {
    savePatientInstruction({ text: instruction });
    onAdd();
  };

  const onAdd = (): void => {
    const localInstructions = [...instructions, { text: instruction }];

    setPartialChartData({
      instructions: localInstructions,
    });
    saveChartData(
      {
        instructions: [{ text: instruction }],
      },
      {
        onSuccess: (data) => {
          const instruction = (data?.instructions || [])[0];
          if (instruction) {
            setPartialChartData({
              instructions: localInstructions.map((item) => (item.resourceId ? item : instruction)),
            });
          }
        },
      },
    );

    setInstruction('');
  };

  const onDelete = (value: CommunicationDTO): void => {
    setPartialChartData({
      instructions: instructions.filter((item) => item.resourceId !== value.resourceId),
    });
    deleteChartData({
      instructions: [value],
    });
  };

  return (
    <>
      <AccordionCard
        label="Patient instructions"
        collapsed={collapsed}
        onSwitch={() => setCollapsed((prevState) => !prevState)}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!isReadOnly && (
            <>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  size="small"
                  label="Instruction"
                  placeholder="Enter a new instruction of select from own saved or Ottehr template"
                  multiline
                  fullWidth
                />
                <RoundedButton onClick={onAdd} disabled={!instruction.trim() || isLoading} startIcon={<AddIcon />}>
                  Add
                </RoundedButton>
                <RoundedButton
                  onClick={onAddAndSave}
                  disabled={!instruction.trim() || isLoading}
                  startIcon={<DoneIcon />}
                >
                  Add & Save
                </RoundedButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <RoundedButton onClick={() => setMyTemplatesOpen(true)}>My templates</RoundedButton>
                <RoundedButton onClick={() => setOttehrTemplatesOpen(true)}>Ottehr templates</RoundedButton>
              </Box>
            </>
          )}

          {instructions.length > 0 && (
            <ActionsList
              data={instructions}
              getKey={(value, index) => value.resourceId || index}
              renderItem={(value) => <Typography>{value.text}</Typography>}
              renderActions={
                isReadOnly
                  ? undefined
                  : (value) => <DeleteIconButton disabled={!value.resourceId} onClick={() => onDelete(value)} />
              }
              divider
              gap={1}
            />
          )}

          {instructions.length === 0 && isReadOnly && (
            <Typography color="secondary.light">No patient instructions provided</Typography>
          )}
        </Box>
      </AccordionCard>

      {myTemplatesOpen && (
        <PatientInstructionsTemplatesDialog
          open={myTemplatesOpen}
          onClose={() => setMyTemplatesOpen(false)}
          type="provider"
          onSelect={(value) => setInstruction(value.text!)}
        />
      )}
      {ottehrTemplatesOpen && (
        <PatientInstructionsTemplatesDialog
          open={ottehrTemplatesOpen}
          onClose={() => setOttehrTemplatesOpen(false)}
          type="organization"
          onSelect={(value) => setInstruction(value.text!)}
        />
      )}
    </>
  );
};
