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
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { applyTemplate, createTemplate } from 'src/api/api';
import { CHART_DATA_QUERY_KEY, CHART_FIELDS_QUERY_KEY } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import { ExamType } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { resetExamObservationsStore } from '../../stores/appointment/reset-exam-observations';
import { TemplateOption, useListTemplates } from './useListTemplates';

const ADD_NEW_SENTINEL = '__ADD_NEW__';

const TEMPLATE_SECTIONS = [
  'HPI (History of Present Illness)',
  'Review of Systems (ROS)',
  'Exam findings',
  'Medical Decision Making (MDM)',
  'Assessment / ICD-10 Diagnoses',
  'Patient Instructions',
  'CPT Codes',
  'E&M Code',
];

export const ApplyTemplate: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<string>('');
  const [isApplyingTemplate, setIsApplyingTemplate] = useState<boolean>(false);
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState<boolean>(false);
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

  const addNewOption: TemplateOption = { value: ADD_NEW_SENTINEL, label: '+ Add Note As New Template' };
  const allOptions: TemplateOption[] = [addNewOption, ...templates];

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  const handleTemplateChange = (event: React.SyntheticEvent, newValue: TemplateOption | null): void => {
    if (newValue) {
      if (newValue.value === ADD_NEW_SENTINEL) {
        setCreateDialogOpen(true);
        return;
      }
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

        // Reset exam observations store to force reload from server
        // This is necessary because exam observations are stored in Zustand (not React Query)
        // and need to be cleared before React Query refetch triggers the update
        resetExamObservationsStore();

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

  const handleCreateDialogClose = (): void => {
    setCreateDialogOpen(false);
    setNewTemplateName('');
  };

  const handleCreateTemplate = async (): Promise<void> => {
    if (!oystehrZambda || !encounter.id || !newTemplateName.trim()) return;

    const trimmedName = newTemplateName.trim();

    // Check for duplicate name
    const existingTemplate = templates.find((t) => t.label.toLowerCase() === trimmedName.toLowerCase());
    if (existingTemplate) {
      enqueueSnackbar(`A template named "${trimmedName}" already exists. Please choose a different name.`, {
        variant: 'warning',
      });
      return;
    }

    setIsCreatingTemplate(true);
    try {
      await createTemplate(oystehrZambda, {
        encounterId: encounter.id,
        templateName: trimmedName,
        examType: ExamType.IN_PERSON,
      });
      await queryClient.invalidateQueries({ queryKey: ['list-templates'] });
      enqueueSnackbar('Template created successfully!', { variant: 'success' });
      handleCreateDialogClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Autocomplete
        id="template-select"
        sx={{ width: '50%', minWidth: 200 }}
        value={selectedTemplate}
        options={allOptions}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.value === value.value}
        onChange={handleTemplateChange}
        disabled={isLoadingTemplates || isReadOnly}
        filterOptions={(options, { inputValue }) => {
          const query = inputValue.toLowerCase();
          return options.filter(
            (option) =>
              option.value === ADD_NEW_SENTINEL ||
              option.label.toLowerCase().includes(query) ||
              option.value.toLowerCase().includes(query)
          );
        }}
        renderOption={(props, option) => {
          if (option.value === ADD_NEW_SENTINEL) {
            return (
              <li {...props} key={option.value}>
                <Typography sx={{ fontWeight: 'bold', color: 'primary.main' }}>{option.label}</Typography>
              </li>
            );
          }
          return (
            <li {...props} key={option.value}>
              {option.label}
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Select condition"
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

      {/* Apply Template Confirmation Dialog */}
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
            the template will override the content in the following sections: Exam, MDM, Dx, Patient Instructions, ROS.
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

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateDialogClose} disableScrollLock maxWidth="sm" fullWidth>
        <DialogTitle variant="h4" color="primary.dark">
          Save Note As Template
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template name"
            fullWidth
            required
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            disabled={isCreatingTemplate}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The following sections from the current note will be saved in the template:
          </Typography>
          <List dense disablePadding sx={{ mt: 1 }}>
            {TEMPLATE_SECTIONS.map((section) => (
              <ListItem key={section} sx={{ py: 0, pl: 2 }}>
                <ListItemText
                  primary={`\u2022 ${section}`}
                  primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={handleCreateDialogClose} sx={buttonSx} disabled={isCreatingTemplate}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleCreateTemplate}
            sx={buttonSx}
            loading={isCreatingTemplate}
            disabled={!newTemplateName.trim()}
          >
            Save
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
