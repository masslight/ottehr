import { Close, Search } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
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
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { RoundedButton } from 'src/components/RoundedButton';
import { CommunicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { InstructionType } from 'utils/lib/types/api/patient-instructions/patient-instructions.types';
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
    setPatientInstructions(data.sort((a, b) => (a.title ?? 'z').localeCompare(b.title ?? 'z')));
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
    return patientInstructions.filter((instruction) => {
      const titleMatch = instruction.title?.toLowerCase().includes(lowerSearchTerm);
      const textMatch = instruction.text?.toLowerCase().includes(lowerSearchTerm);

      return titleMatch || textMatch;
    });
  }, [patientInstructions, searchTerm]);

  return (
    <AppDialog
      variant="form"
      size="m"
      open={open}
      onClose={onClose}
      title={isMyTemplates ? 'My Quick Picks' : 'Practice Quick Picks'}
    >
      {/* The search stays in view while the list scrolls under it. */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, mx: -3, px: 3, pt: 1, bgcolor: 'background.paper' }}>
        <TextField
          placeholder="Search Quick Picks"
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
        <Divider sx={{ mx: -3, mt: 2 }} />
      </Box>
      <Box sx={{ pt: 3 }}>
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
            renderItem={(value) => (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {value.title && <Typography fontWeight={600}>{value.title}</Typography>}
                {value.text && <Typography style={{ whiteSpace: 'pre-line' }}>{value.text}</Typography>}
              </Box>
            )}
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
      </Box>
    </AppDialog>
  );
};
