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
  Collapse,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { LabTest, TestResult } from 'utils';
import { History } from './History';

interface PerformTestViewProps {
  testDetails: LabTest;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export const PerformTestView: React.FC<PerformTestViewProps> = ({ testDetails, onBack, onSubmit }) => {
  const [result, setResult] = useState<TestResult>(testDetails.result || null);
  const [indeterminate, setIndeterminate] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState(testDetails.notes || '');

  const handleToggleDetails = (): void => {
    setShowDetails(!showDetails);
  };

  const handleReprintLabel = (): void => {
    console.log('Reprinting label for test:', testDetails.id);
  };

  const handleSubmit = (): void => {
    onSubmit({
      status: 'FINAL',
      result: indeterminate ? 'INDETERMINATE' : result,
      notes,
    });
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {testDetails.diagnosis}
      </Typography>

      <Typography variant="h4" color="primary.dark" sx={{ mb: 3, fontWeight: 'bold' }}>
        Perform Test & Enter Results
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Box sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" color="primary.dark" fontWeight="bold">
              {testDetails.name}
            </Typography>
            <Box
              sx={{
                bgcolor: '#E8DEFF',
                color: '#5E35B1',
                fontWeight: 'bold',
                px: 2,
                py: 0.5,
                borderRadius: '4px',
                fontSize: '0.75rem',
              }}
            >
              COLLECTED
            </Box>
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
              control={<Checkbox checked={indeterminate} onChange={(e) => setIndeterminate(e.target.checked)} />}
              label="Indeterminate / inconclusive / error"
              sx={{ color: 'text.secondary' }}
            />
          </Box>

          <Box display="flex" justifyContent="flex-end" mt={2} mb={3}>
            <Button
              variant="text"
              color="primary"
              onClick={handleToggleDetails}
              endIcon={showDetails ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            >
              Details
            </Button>
          </Box>

          <Collapse in={showDetails}>
            <History
              testDetails={testDetails}
              setNotes={setNotes}
              notes={notes}
              handleReprintLabel={handleReprintLabel}
            />
          </Collapse>

          <Box display="flex" justifyContent="space-between">
            <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
              Back
            </Button>

            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!result && !indeterminate}
              sx={{ borderRadius: '50px', px: 4 }}
            >
              Submit
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
