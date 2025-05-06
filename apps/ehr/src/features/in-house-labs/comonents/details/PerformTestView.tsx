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
  TextField,
  Divider,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { LabTest, TestResult } from '../../labTypes';
import { DateTime } from 'luxon';

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

  const formatDateTime = (dateString: string): string => {
    try {
      return DateTime.fromISO(dateString).toFormat("MM/dd/yyyy 'at' h:mm a");
    } catch (error) {
      return dateString;
    }
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
            <Box mb={3}>
              <Box sx={{ mt: 3, mb: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Provider notes
                </Typography>
                <TextField fullWidth multiline rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Box>

              {testDetails.orderDetails && (
                <Box mt={3}>
                  <Button variant="outlined" onClick={handleReprintLabel} sx={{ mb: 3 }}>
                    Re-Print Label
                  </Button>

                  <Grid container sx={{ backgroundColor: '#F8F9FA', p: 2 }}>
                    <Grid item xs={3}>
                      <Box
                        sx={{
                          bgcolor: '#F1F3F4',
                          color: '#5F6368',
                          fontWeight: 'bold',
                          px: 2,
                          py: 0.5,
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          display: 'inline-block',
                        }}
                      >
                        ORDERED
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2">{testDetails.orderDetails.orderedBy}</Typography>
                    </Grid>
                    <Grid item xs={5}>
                      <Typography variant="body2">{formatDateTime(testDetails.orderDetails.orderedDate)}</Typography>
                    </Grid>

                    <Grid item xs={12} sx={{ mt: 1 }}>
                      <Divider />
                    </Grid>

                    <Grid item xs={3} sx={{ mt: 1 }}>
                      <Box
                        sx={{
                          bgcolor: '#E8DEFF',
                          color: '#5E35B1',
                          fontWeight: 'bold',
                          px: 2,
                          py: 0.5,
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          display: 'inline-block',
                        }}
                      >
                        COLLECTED
                      </Box>
                    </Grid>
                    <Grid item xs={4} sx={{ mt: 1 }}>
                      <Typography variant="body2">{testDetails.orderDetails.collectedBy || ''}</Typography>
                    </Grid>
                    <Grid item xs={5} sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        {testDetails.orderDetails.collectedDate
                          ? formatDateTime(testDetails.orderDetails.collectedDate)
                          : ''}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
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
