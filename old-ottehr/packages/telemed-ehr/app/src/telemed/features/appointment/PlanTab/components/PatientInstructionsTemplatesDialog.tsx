import React, { FC, useState } from 'react';
import { useQueryClient } from 'react-query';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CommunicationDTO, InstructionType } from 'ehr-utils';
import { useDeletePatientInstruction, useGetPatientInstructions } from '../../../../state';
import { ActionsList, DeleteIconButton, RoundedButton } from '../../../../components';

type MyTemplatesDialogProps = {
  open: boolean;
  onClose: () => void;
  type: InstructionType;
  onSelect: (value: CommunicationDTO) => void;
};

export const PatientInstructionsTemplatesDialog: FC<MyTemplatesDialogProps> = (props) => {
  const { open, onClose, type, onSelect } = props;

  const theme = useTheme();
  const [patientInstructions, setPatientInstructions] = useState<CommunicationDTO[]>([]);
  const { isFetching } = useGetPatientInstructions({ type }, (data) => {
    setPatientInstructions(data);
  });
  const isMyTemplates = type === 'provider';
  const { mutate, isLoading: isDeleting } = useDeletePatientInstruction();
  const queryClient = useQueryClient();

  const onDelete = (id: string): void => {
    mutate(
      { id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['telemed-get-patient-instructions'] });
        },
      },
    );
    setPatientInstructions((prevState) => prevState.filter((instruction) => instruction.resourceId !== id));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle component="div" sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'flex-start' }}>
        <Typography variant="h4" color={theme.palette.primary.dark} sx={{ flex: 1 }}>
          {isMyTemplates ? 'My instruction templates' : 'Ottehr instruction templates '}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent
        sx={{
          p: 3,
        }}
      >
        {isFetching && patientInstructions.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : patientInstructions.length === 0 ? (
          <Typography color={theme.palette.text.secondary}>No instruction templates</Typography>
        ) : (
          <ActionsList
            data={patientInstructions}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => <Typography>{value.text}</Typography>}
            renderActions={(value) => (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {isMyTemplates && (
                  <DeleteIconButton disabled={isDeleting} onClick={() => onDelete(value.resourceId!)} />
                )}
                <RoundedButton
                  onClick={() => {
                    onSelect(value);
                    onClose();
                  }}
                  variant="contained"
                >
                  Select
                </RoundedButton>
              </Box>
            )}
            gap={2}
            divider
            alignItems="flex-start"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
