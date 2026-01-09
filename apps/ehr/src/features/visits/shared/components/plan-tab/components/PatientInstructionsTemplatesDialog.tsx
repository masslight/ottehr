import { Close, Search } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, FC, useMemo, useState } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { RoundedButton } from 'src/components/RoundedButton';
import { BRANDING_CONFIG, CommunicationDTO, InstructionType } from 'utils';
import {
  useDeletePatientInstruction,
  useGetPatientInstructions,
} from '../../../stores/appointment/appointment.queries';

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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { isFetching } = useGetPatientInstructions({ type }, (data) => {
    if (!data) return;
    setPatientInstructions(data);
  });
  const isMyTemplates = type === 'provider';
  const { mutate, isPending: isDeleting } = useDeletePatientInstruction();
  const queryClient = useQueryClient();

  const onDelete = (id: string): void => {
    mutate(
      { instructionId: id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['telemed-get-patient-instructions'] });
        },
      }
    );
    setPatientInstructions((prevState) => prevState.filter((instruction) => instruction.resourceId !== id));
  };

  // Filter instructions based on search term
  const filteredInstructions = useMemo(() => {
    if (!searchTerm.trim()) {
      return patientInstructions;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return patientInstructions.filter((instruction) => instruction.text?.toLowerCase().includes(lowerSearchTerm));
  }, [patientInstructions, searchTerm]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle component="div" sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'flex-start' }}>
        <Typography variant="h4" color={theme.palette.primary.dark} sx={{ flex: 1 }}>
          {isMyTemplates ? 'My instruction templates' : `${BRANDING_CONFIG.projectName} instruction templates `}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <TextField
          placeholder="Search templates"
          fullWidth
          value={searchTerm}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearchTerm(event.target.value);
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {searchTerm.length > 0 ? (
                  <IconButton
                    aria-label="clear search"
                    onClick={() => {
                      setSearchTerm('');
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    sx={{ p: 0 }}
                  >
                    <Close />
                  </IconButton>
                ) : (
                  <Search />
                )}
              </InputAdornment>
            ),
          }}
        />
      </Box>
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
        ) : filteredInstructions.length === 0 ? (
          <Typography color={theme.palette.text.secondary}>
            {patientInstructions.length === 0 ? 'No instruction templates' : 'No templates match your search'}
          </Typography>
        ) : (
          <ActionsList
            data={filteredInstructions}
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
