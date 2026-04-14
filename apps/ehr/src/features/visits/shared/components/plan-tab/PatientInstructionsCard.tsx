import AddIcon from '@mui/icons-material/Add';
import DoneIcon from '@mui/icons-material/Done';
import SchoolIcon from '@mui/icons-material/School';
import {
  Box,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { BRANDING_CONFIG, CommunicationDTO } from 'utils';
import { AccordionCard } from '../../../../../components/AccordionCard';
import { ActionsList } from '../../../../../components/ActionsList';
import { DeleteIconButton } from '../../../../../components/DeleteIconButton';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { usePatientEducation } from '../../hooks/usePatientEducation';
import { useSavePatientInstruction } from '../../stores/appointment/appointment.queries';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../stores/appointment/appointment.store';
import { PatientInstructionsTemplatesDialog } from './components/PatientInstructionsTemplatesDialog';

export const PatientInstructionsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [myTemplatesOpen, setMyTemplatesOpen] = useState(false);
  const [defaultTemplatesOpen, setDefaultTemplatesOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [instructionTitle, setInstructionTitle] = useState('');
  const { mutate: savePatientInstruction, isPending: isSavePatientInstructionLoading } = useSavePatientInstruction();
  const { mutate: saveChartData, isPending: isSaveChartDataLoading } = useSaveChartData();
  const { mutate: deleteChartData } = useDeleteChartData();
  const isLoading = isSavePatientInstructionLoading || isSaveChartDataLoading;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Set<string>>(new Set());
  const {
    generateForDiagnoses,
    isLoading: isEducationLoading,
    error: educationError,
    progress: educationProgress,
    allDiagnoses,
  } = usePatientEducation();
  const { chartData, setPartialChartData } = useChartData();
  const instructions = chartData?.instructions || [];

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
      ...instructions,
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
          setPartialChartData({ instructions });
          setInstruction(instruction);
          setInstructionTitle(instructionTitle);
        },
      }
    );

    setInstruction('');
    setInstructionTitle('');
  };

  const onDelete = (value: CommunicationDTO): void => {
    const prevInstructions = [...instructions];
    // Optimistic update
    setPartialChartData(
      {
        instructions: instructions.filter((item) => item.resourceId !== value.resourceId),
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
                    placeholder={`Enter a new instruction of select from own saved or ${BRANDING_CONFIG.projectName} template`}
                    multiline
                    fullWidth
                  />
                </Box>
                <RoundedButton onClick={() => setMyTemplatesOpen(true)}>My Templates</RoundedButton>
                <RoundedButton onClick={() => setDefaultTemplatesOpen(true)}>
                  {BRANDING_CONFIG.projectName} Templates
                </RoundedButton>
                <RoundedButton
                  onClick={() => {
                    // Pre-select all diagnoses
                    setSelectedDiagnoses(new Set(allDiagnoses.map((d) => d.code)));
                    setEducationModalOpen(true);
                  }}
                  disabled={allDiagnoses.length === 0 || isEducationLoading}
                  startIcon={isEducationLoading ? <CircularProgress size={16} /> : <SchoolIcon />}
                >
                  Patient Education
                </RoundedButton>
              </Box>
              {(educationError || educationProgress) && (
                <Typography color={educationError ? 'error' : 'text.secondary'} variant="body2">
                  {educationError || educationProgress}
                </Typography>
              )}
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
                  Add & Save as Template
                </RoundedButton>
              </Box>
            </>
          )}

          {instructions.length > 0 && (
            <ActionsList
              data={instructions}
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
          onSelect={(value) => {
            setInstruction(value.text ?? '');
            setInstructionTitle(value.title ?? '');
          }}
        />
      )}
      {defaultTemplatesOpen && (
        <PatientInstructionsTemplatesDialog
          open={defaultTemplatesOpen}
          onClose={() => setDefaultTemplatesOpen(false)}
          type="organization"
          onSelect={(value) => {
            setInstruction(value.text ?? '');
            setInstructionTitle(value.title ?? '');
          }}
        />
      )}

      <Dialog
        open={educationModalOpen}
        onClose={() => !isEducationLoading && setEducationModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Patient Education Materials</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the diagnoses to include in the patient education document.
          </Typography>
          {allDiagnoses.length === 0 ? (
            <Typography color="text.secondary">
              No diagnoses on this visit. Add diagnoses in the Assessment tab first.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {allDiagnoses.map((diagnosis) => (
                <FormControlLabel
                  key={diagnosis.code}
                  control={
                    <Checkbox
                      checked={selectedDiagnoses.has(diagnosis.code)}
                      onChange={(e) => {
                        setSelectedDiagnoses((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(diagnosis.code);
                          else next.delete(diagnosis.code);
                          return next;
                        });
                      }}
                      disabled={isEducationLoading}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      <strong>{diagnosis.code}</strong> — {diagnosis.display}
                      {diagnosis.isPrimary && (
                        <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
                          (Primary)
                        </Typography>
                      )}
                    </Typography>
                  }
                />
              ))}
            </Box>
          )}
          {educationProgress && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {educationProgress}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <RoundedButton onClick={() => setEducationModalOpen(false)} disabled={isEducationLoading}>
            Cancel
          </RoundedButton>
          <RoundedButton
            variant="contained"
            onClick={async () => {
              const selected = allDiagnoses.filter((d) => selectedDiagnoses.has(d.code));
              await generateForDiagnoses(selected);
              if (!educationError) {
                setEducationModalOpen(false);
              }
            }}
            disabled={selectedDiagnoses.size === 0 || isEducationLoading}
            startIcon={isEducationLoading ? <CircularProgress size={16} /> : <SchoolIcon />}
          >
            Generate ({selectedDiagnoses.size})
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </>
  );
};
