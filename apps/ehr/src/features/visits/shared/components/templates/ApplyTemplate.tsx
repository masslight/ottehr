import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { applyTemplate } from 'src/api/api';
import { CHART_DATA_QUERY_KEY, CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import { ExamType } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { TemplateOption, useListTemplates } from './useListTemplates';

export const ApplyTemplate: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<string>('');
  const [isApplyingTemplate, setIsApplyingTemplate] = useState<boolean>(false);
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const { encounter } = useAppointmentData();
  const queryClient = useQueryClient();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

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

  const handleTemplateChange = (event: React.SyntheticEvent, newValue: TemplateOption | null): void => {
    if (newValue) {
      setPendingTemplate(newValue.value);
      setDialogOpen(true);
    } else {
      setSelectedTemplate(null);
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
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [CHART_DATA_QUERY_KEY, encounter.id] }),
          queryClient.invalidateQueries({ queryKey: [CHART_FIELDS_QUERY_KEY, encounter.id] }),
        ]);

        enqueueSnackbar('Template applied successfully!', { variant: 'success' });
      } catch (error) {
        console.log('error', JSON.stringify(error));
        const errorMessage = error instanceof Error ? error.message : 'An error occurred while applying the template';
        enqueueSnackbar(errorMessage, { variant: 'error' });
      } finally {
        setIsApplyingTemplate(false);
      }
    }
    // Find the template option that matches the pendingTemplate value
    const selectedTemplateOption = templates.find((template) => template.value === pendingTemplate) || null;
    setSelectedTemplate(selectedTemplateOption);
    setDialogOpen(false);
    setPendingTemplate('');
  };

  const getTemplateName = (value: string): string => {
    return templates.find((option) => option.value === value)?.label || '';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Autocomplete
        id="template-select"
        sx={{ width: '50%', minWidth: 200 }}
        value={selectedTemplate}
        options={templates}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        onChange={handleTemplateChange}
        disabled={isLoadingTemplates || isReadOnly}
        filterOptions={(options, { inputValue }) => {
          // Implement fuzzy search - filter by both label and value
          const query = inputValue.toLowerCase();
          return options.filter(
            (option) => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Select Template"
            placeholder={isLoadingTemplates ? 'Loading templates...' : 'Search templates...'}
          />
        )}
        noOptionsText={isLoadingTemplates ? 'Loading templates...' : 'No templates found'}
      />

      {selectedTemplate && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Applied template: {selectedTemplate.label}
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
            the template will override the content in the following sections: Exam, MDM, Dx, Patient Instructions.
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
