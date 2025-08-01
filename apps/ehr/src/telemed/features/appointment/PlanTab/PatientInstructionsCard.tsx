import AddIcon from '@mui/icons-material/Add';
import DoneIcon from '@mui/icons-material/Done';
import { Box, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { FC, useState } from 'react';
import { CommunicationDTO, PROJECT_NAME } from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { AccordionCard, ActionsList, DeleteIconButton } from '../../../components';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { useAppointmentStore, useDeleteChartData, useSaveChartData, useSavePatientInstruction } from '../../../state';
import { PatientInstructionsTemplatesDialog } from './components';

export const PatientInstructionsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const [myTemplatesOpen, setMyTemplatesOpen] = useState(false);
  const [defaultTemplatesOpen, setDefaultTemplatesOpen] = useState(false);

  const [instruction, setInstruction] = useState('');

  const { mutate: savePatientInstruction, isPending: isSavePatientInstructionLoading } = useSavePatientInstruction();
  const { mutate: saveChartData, isPending: isSaveChartDataLoading } = useSaveChartData();
  const { mutate: deleteChartData } = useDeleteChartData();

  const isLoading = isSavePatientInstructionLoading || isSaveChartDataLoading;

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { chartData, setPartialChartData } = getSelectors(useAppointmentStore, ['chartData', 'setPartialChartData']);
  const instructions = chartData?.instructions || [];

  const onAddAndSave = (): void => {
    savePatientInstruction(
      { text: instruction },
      {
        onError: () => {
          enqueueSnackbar('An error has occurred while saving patient instruction template. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
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
          const instruction = (data?.chartData?.instructions || [])[0];
          if (instruction) {
            setPartialChartData({
              instructions: localInstructions.map((item) => (item.resourceId ? item : instruction)),
            });
          }
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while adding patient instruction. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({ instructions });
          setInstruction(instruction);
        },
      }
    );

    setInstruction('');
  };

  const onDelete = (value: CommunicationDTO): void => {
    setPartialChartData({
      instructions: instructions.filter((item) => item.resourceId !== value.resourceId),
    });
    deleteChartData(
      {
        instructions: [value],
      },
      {
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting patient instruction. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({ instructions });
        },
      }
    );
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
                  placeholder={`Enter a new instruction of select from own saved or ${PROJECT_NAME} template`}
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
                <RoundedButton onClick={() => setDefaultTemplatesOpen(true)}>{PROJECT_NAME} templates</RoundedButton>
              </Box>
            </>
          )}

          {instructions.length > 0 && (
            <ActionsList
              data={instructions}
              getKey={(value, index) => value.resourceId || index}
              renderItem={(value) => <Typography style={{ whiteSpace: 'pre-line' }}>{value.text}</Typography>}
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
      {defaultTemplatesOpen && (
        <PatientInstructionsTemplatesDialog
          open={defaultTemplatesOpen}
          onClose={() => setDefaultTemplatesOpen(false)}
          type="organization"
          onSelect={(value) => setInstruction(value.text!)}
        />
      )}
    </>
  );
};
