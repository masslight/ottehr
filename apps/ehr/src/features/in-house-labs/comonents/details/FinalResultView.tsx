import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  Chip,
} from '@mui/material';
import { LabTest, TestResult } from '../../labTypes';

interface FinalResultViewProps {
  testDetails: LabTest;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export const FinalResultView: React.FC<FinalResultViewProps> = ({ testDetails, onBack, onSubmit }) => {
  const [result, setResult] = useState<TestResult>(testDetails.result || null);
  const [indeterminate, _setIndeterminate] = useState(false);

  const handleSave = (): void => {
    onSubmit({
      result,
      indeterminate,
    });
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {testDetails.diagnosis}
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" color="primary.dark" fontWeight="bold">
              {testDetails.name}
            </Typography>
            <Chip
              label="FINAL"
              sx={{
                color: '#1976D2',
                bgcolor: '#E6F4FF',
                fontWeight: 'bold',
                borderRadius: '4px',
                height: '24px',
              }}
            />
          </Box>

          <RadioGroup value={result} onChange={(e) => setResult(e.target.value as TestResult)}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControlLabel
                  value="NOT_DETECTED"
                  control={
                    <Radio
                      checked={result === 'NOT_DETECTED'}
                      sx={{
                        color: result === 'NOT_DETECTED' ? '#4CAF50' : undefined,
                        '&.Mui-checked': {
                          color: '#4CAF50',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography
                      sx={{
                        color: result === 'NOT_DETECTED' ? '#4CAF50' : 'text.secondary',
                        fontWeight: result === 'NOT_DETECTED' ? 'bold' : 'regular',
                      }}
                    >
                      Not detected
                    </Typography>
                  }
                  sx={{
                    margin: 0,
                    padding: 2,
                    width: '100%',
                    border: '1px solid #E0E0E0',
                    borderRadius: 1,
                    backgroundColor: result === 'NOT_DETECTED' ? '#E8F5E9' : 'transparent',
                  }}
                />
              </Grid>

              <Grid item xs={6}>
                <FormControlLabel
                  value="DETECTED"
                  control={
                    <Radio
                      checked={result === 'DETECTED'}
                      sx={{
                        color: result === 'DETECTED' ? '#F44336' : undefined,
                        '&.Mui-checked': {
                          color: '#F44336',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography
                      sx={{
                        color: result === 'DETECTED' ? '#F44336' : 'text.secondary',
                        fontWeight: result === 'DETECTED' ? 'bold' : 'regular',
                      }}
                    >
                      Detected
                    </Typography>
                  }
                  sx={{
                    margin: 0,
                    padding: 2,
                    width: '100%',
                    border: '1px solid #E0E0E0',
                    borderRadius: 1,
                    backgroundColor: result === 'DETECTED' ? '#FFEBEE' : 'transparent',
                  }}
                />
              </Grid>
            </Grid>
          </RadioGroup>

          <Box mt={2}>
            <FormControlLabel
              control={<Checkbox checked={indeterminate} disabled />}
              label="Indeterminate / inconclusive / error"
              sx={{ color: 'text.secondary' }}
            />
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
            <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
              Back
            </Button>

            <Button variant="contained" color="primary" onClick={handleSave} sx={{ borderRadius: '50px', px: 4 }}>
              Save changes
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
