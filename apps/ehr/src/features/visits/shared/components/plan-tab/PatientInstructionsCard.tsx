import AddIcon from '@mui/icons-material/Add';
import DoneIcon from '@mui/icons-material/Done';
import { Box, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { CommunicationDTO } from 'utils';
import { AccordionCard } from '../../../../../components/AccordionCard';
import { ActionsList } from '../../../../../components/ActionsList';
import { DeleteIconButton } from '../../../../../components/DeleteIconButton';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useSavePatientInstruction } from '../../stores/appointment/appointment.queries';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../stores/appointment/appointment.store';
import { PatientInstructionsTemplatesDialog } from './components/PatientInstructionsTemplatesDialog';

export const PatientInstructionsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [myQuickPicksOpen, setMyQuickPicksOpen] = useState(false);
  const [practiceQuickPicksOpen, setPracticeQuickPicksOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [instructionTitle, setInstructionTitle] = useState('');
  const { mutate: savePatientInstruction, isPending: isSavePatientInstructionLoading } = useSavePatientInstruction();
  const { mutate: saveChartData, isPending: isSaveChartDataLoading } = useSaveChartData();
  const { mutate: deleteChartData } = useDeleteChartData();
  const isLoading = isSavePatientInstructionLoading || isSaveChartDataLoading;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { chartData, setPartialChartData } = useChartData();
  const allInstructions = chartData?.instructions || [];
  const instructionsWithoutEduDocs = allInstructions.filter((item) => !item.educationDocRefId);

  const onAddAndSave = (): void => {
    savePatientInstruction(
      { text: instruction, title: instructionTitle },
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
    const localInstructions = [
      ...allInstructions,
      {
        text: instruction || undefined,
        title: instructionTitle || undefined,
      },
    ];

    // Optimistic update
    setPartialChartData({
      instructions: localInstructions,
    });
    saveChartData(
      {
        instructions: [
          {
            text: instruction || undefined,
            title: instructionTitle || undefined,
          },
        ],
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
          // Rollback to previous state
          setPartialChartData({ instructions: allInstructions });
          setInstruction(instruction);
          setInstructionTitle(instructionTitle);
        },
      }
    );

    setInstruction('');
    setInstructionTitle('');
  };

  const onDelete = (value: CommunicationDTO): void => {
    const prevInstructions = [...allInstructions];
    // Optimistic update
    setPartialChartData(
      {
        instructions: allInstructions.filter((item) => item.resourceId !== value.resourceId),
      },
      { invalidateQueries: false }
    );
    deleteChartData(
      {
        instructions: [value],
      },
      {
        onSuccess: () => {
          // No need to update again, optimistic update already applied
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting patient instruction. Please try again.', {
            variant: 'error',
          });
          // Rollback to previous state
          setPartialChartData({ instructions: prevInstructions });
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
                <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 2 }}>
                  <TextField
                    value={instructionTitle}
                    onChange={(e) => setInstructionTitle(e.target.value)}
                    size="small"
                    label="Instruction title"
                    placeholder="Instruction title"
                    fullWidth
                  />
                  <TextField
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    size="small"
                    label="Instruction"
                    placeholder="Enter a new instruction or select from My Quick Picks or Practice Quick Picks"
                    multiline
                    fullWidth
                  />
                </Box>
                <RoundedButton onClick={() => setMyQuickPicksOpen(true)}>My Quick Picks</RoundedButton>
                <RoundedButton onClick={() => setPracticeQuickPicksOpen(true)}>Practice Quick Picks</RoundedButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <RoundedButton
                  onClick={onAdd}
                  disabled={(!instruction.trim() && !instructionTitle.trim()) || isLoading}
                  startIcon={<AddIcon />}
                >
                  Add
                </RoundedButton>
                <RoundedButton
                  onClick={onAddAndSave}
                  disabled={(!instruction.trim() && !instructionTitle.trim()) || isLoading}
                  startIcon={<DoneIcon />}
                >
                  Add & Save to My Quick Picks
                </RoundedButton>
              </Box>
            </>
          )}

          {instructionsWithoutEduDocs.length > 0 && (
            <ActionsList
              data={instructionsWithoutEduDocs}
              getKey={(value, index) => value.resourceId || index}
              renderItem={(value) => (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {value.title && <Typography fontWeight={600}>{value.title}</Typography>}
                  {value.text && <Typography style={{ whiteSpace: 'pre-line' }}>{value.text}</Typography>}
                </Box>
              )}
              renderActions={
                isReadOnly
                  ? undefined
                  : (value) => <DeleteIconButton disabled={!value.resourceId} onClick={() => onDelete(value)} />
              }
              divider
              gap={1}
            />
          )}

          {instructionsWithoutEduDocs.length === 0 && isReadOnly && (
            <Typography color="secondary.light">No patient instructions provided</Typography>
          )}
        </Box>
      </AccordionCard>

      {myQuickPicksOpen && (
        <PatientInstructionsTemplatesDialog
          open={true}
          onClose={() => setMyQuickPicksOpen(false)}
          type="provider"
          onSelect={(value) => {
            setInstruction(value.text ?? '');
            setInstructionTitle(value.title ?? '');
          }}
        />
      )}
      {practiceQuickPicksOpen && (
        <PatientInstructionsTemplatesDialog
          open={true}
          onClose={() => setPracticeQuickPicksOpen(false)}
          type="organization"
          onSelect={(value) => {
            setInstruction(value.text ?? '');
            setInstructionTitle(value.title ?? '');
          }}
        />
      )}
    </>
  );
};
