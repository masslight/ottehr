import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { ExamType } from 'utils';
import { applyTemplate } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { CHART_DATA_QUERY_KEY_BASE, useAppointmentData } from '../..';
import { useListTemplates } from '../../state/useListTemplates';

export const ApplyTemplate: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<string>('');
  const [isApplyingTemplate, setIsApplyingTemplate] = useState<boolean>(false);
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const { encounter } = useAppointmentData();
  const queryClient = useQueryClient();

  // Load templates using custom react-query hook
  const { templates, isLoading: isLoadingTemplates, error: templatesError } = useListTemplates(ExamType.IN_PERSON);

  // Show error toast when template loading fails
  React.useEffect(() => {
    if (templatesError) {
      console.error('Error loading templates:', templatesError);
      enqueueSnackbar('Failed to load templates', { variant: 'error' });
    }
  }, [templatesError]);

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  const handleTemplateChange = (event: SelectChangeEvent<string>): void => {
    const newValue = event.target.value;
    if (newValue) {
      setPendingTemplate(newValue);
      setDialogOpen(true);
    } else {
      setSelectedTemplate('');
      setPendingTemplate('');
    }
  };

  const handleDialogClose = (): void => {
    setDialogOpen(false);
    setPendingTemplate('');
  };

  const handleApplyTemplate = async (): Promise<void> => {
    if (oystehrZambda && encounter.id) {
      setIsApplyingTemplate(true);
      try {
        await applyTemplate(oystehrZambda, {
          encounterId: encounter.id,
          templateName: pendingTemplate,
          examType: ExamType.IN_PERSON,
        });

        // TODO: use window.location.reload() if there are issues with queryClient.invalidateQueries
        await queryClient.invalidateQueries({ queryKey: [CHART_DATA_QUERY_KEY_BASE, encounter.id] });
        enqueueSnackbar('Template applied successfully!', { variant: 'success' });
      } catch (error) {
        console.log('error', JSON.stringify(error));
        const errorMessage = error instanceof Error ? error.message : 'An error occurred while applying the template';
        enqueueSnackbar(errorMessage, { variant: 'error' });
      } finally {
        setIsApplyingTemplate(false);
      }
    }
    setSelectedTemplate(pendingTemplate);
    setDialogOpen(false);
    setPendingTemplate('');
  };

  const getTemplateName = (value: string): string => {
    return templates.find((option) => option.value === value)?.label || '';
  };

  return (
    <Box sx={{ p: 2 }}>
      <FormControl variant="outlined" sx={{ width: '50%', minWidth: 200 }}>
        <InputLabel id="template-select-label">Select Template</InputLabel>
        <Select
          labelId="template-select-label"
          id="template-select"
          value={selectedTemplate}
          label="Select Template"
          onChange={handleTemplateChange}
          disabled={isLoadingTemplates}
        >
          {isLoadingTemplates ? (
            <MenuItem disabled>Loading templates...</MenuItem>
          ) : (
            templates.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {selectedTemplate && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Applied template: {getTemplateName(selectedTemplate)}
          </Typography>
        </Box>
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        disableScrollLock
        sx={{
          '.MuiPaper-root': {
            padding: 2,
          },
        }}
      >
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '80%' }}>
          Apply Template
        </DialogTitle>
        <DialogContent>
          <DialogContentText
            sx={{
              color: theme.palette.text.primary,
            }}
          >
            Are you sure you want to apply the <strong>{getTemplateName(pendingTemplate)}</strong> template? Applying
            the template will override the content in the following sections: HPI, Exam, MDM, Dx, Patient Instructions,
            Disposition.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Button
            variant="outlined"
            onClick={handleDialogClose}
            size="medium"
            sx={buttonSx}
            disabled={isApplyingTemplate}
          >
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleApplyTemplate}
            size="medium"
            sx={buttonSx}
            loading={isApplyingTemplate}
          >
            Apply Template
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
