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
import React, { useState } from 'react';

interface TemplateOption {
  value: string;
  label: string;
}

const templateOptions: TemplateOption[] = [
  {
    value: 'otitis-media',
    label: 'Otitis Media',
  },
];

export const ApplyTemplate: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<string>('');
  const theme = useTheme();

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

  const handleApplyTemplate = (): void => {
    setSelectedTemplate(pendingTemplate);
    setDialogOpen(false);
    setPendingTemplate('');
    // TODO: Add actual template application logic here
  };

  const getTemplateName = (value: string): string => {
    return templateOptions.find((option) => option.value === value)?.label || '';
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
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {templateOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
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
          <Button variant="outlined" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleApplyTemplate} size="medium" sx={buttonSx}>
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
