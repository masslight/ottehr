import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data';
import { TestItem } from 'utils';
import { useApiClients } from 'src/hooks/useAppClients';
import { getCreateInHouseLabOrderResources } from 'src/api/api';

export const InHouseLabOrderCreatePage: React.FC = () => {
  const { serviceRequestID } = useParams<{ serviceRequestID: string }>();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableTests, setAvailableTests] = useState<TestItem[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [availableCptCodes, setAvailableCptCodes] = useState<string[]>([]);
  const [selectedCptCode, setSelectedCptCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const { chartData, patient, encounter } = getSelectors(useAppointmentStore, ['chartData', 'patient', 'encounter']);
  const primaryDiagnosis = [chartData?.diagnosis?.find((d) => d.isPrimary)].filter((d): d is DiagnosisDTO => !!d);
  const [availableDiagnoses, _setAvailableDiagnoses] = useState<DiagnosisDTO[]>(primaryDiagnosis);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<DiagnosisDTO[]>([]);

  useEffect(() => {
    if (!oystehrZambda) {
      return;
    }

    const fetchLabs = async (): Promise<void> => {
      try {
        setLoading(true);
        const response = await getCreateInHouseLabOrderResources(oystehrZambda, {
          serviceRequestId: serviceRequestID!,
        });
        const testItems = Object.values(response.labs || {});
        setAvailableTests(testItems);
        setProviderName(response.providerName);
      } catch (error) {
        console.error('Error fetching labs:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchLabs();
  }, [oystehrZambda, serviceRequestID]);

  // TODO: implement diagnosis
  // Uncomment this in real implementation to use actual diagnoses from the store
  // useEffect(() => {
  //   if (diagnoses.length > 0) {
  //     setAvailableDiagnoses(diagnoses);
  //   }
  // }, [diagnoses]);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleAddDiagnosis = (): void => {
    // In a real implementation, this would open a dialog to add another diagnosis
    console.log('Add additional diagnosis');
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    try {
      // In a real implementation, this would submit the order to the API
      console.log('Order submitted:', {
        testType: selectedTest,
        cptCode: selectedCptCode,
        diagnoses: selectedDiagnoses,
        notes: notes,
        patientId: patient?.id,
        encounterId: encounter?.id,
        provider: providerName,
      });

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Navigate back to the lab orders list
      navigate(-1);
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderAndPrint = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    try {
      // Submit the order first
      console.log('Order submitted with print:', {
        testType: selectedTest,
        cptCode: selectedCptCode,
        diagnoses: selectedDiagnoses,
        notes: notes,
        patientId: patient?.id,
        encounterId: encounter?.id,
        provider: providerName,
        printLabel: true,
      });

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // In a real implementation, this would trigger a print job for the label

      // Navigate back to the lab orders list
      navigate(-1);
    } catch (error) {
      console.error('Error submitting order and printing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSelection = (selectedTest: string): void => {
    if (!availableTests?.length) {
      return;
    }

    const findedEntry = availableTests.find((test) => test.name === selectedTest);

    if (!findedEntry) {
      return;
    }

    setSelectedTest(findedEntry.name);
    setAvailableCptCodes(findedEntry.cptCode);
  };

  return (
    <Box>
      <Typography variant="h4" color="primary.dark" sx={{ mb: 3 }}>
        Order In-house Lab
      </Typography>

      <Paper sx={{ p: 4 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel id="test-type-label">Test</InputLabel>
                  <Select
                    labelId="test-type-label"
                    id="test-type"
                    value={selectedTest}
                    label="Test"
                    onChange={(e) => handleTestSelection(e.target.value)}
                  >
                    {availableTests.map((test) => (
                      <MenuItem key={test.name} value={test.name}>
                        {test.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {availableCptCodes.length > 0 && (
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel id="cpt-code-label">CPT code*</InputLabel>
                    <Select
                      labelId="cpt-code-label"
                      id="cpt-code"
                      value={selectedCptCode}
                      label="CPT code*"
                      onChange={(e) => setSelectedCptCode(e.target.value)}
                    >
                      {availableCptCodes.map((cpt) => (
                        <MenuItem key={cpt} value={cpt}>
                          {cpt}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel id="diagnosis-label">Dx*</InputLabel>
                  <Select
                    labelId="diagnosis-label"
                    id="diagnosis"
                    value={selectedDiagnoses.length > 0 ? selectedDiagnoses[0].code : ''}
                    label="Dx*"
                    onChange={(e) => {
                      const selected = availableDiagnoses.find((dx) => dx.code === e.target.value);
                      if (selected) {
                        setSelectedDiagnoses([selected]);
                      }
                    }}
                  >
                    {availableDiagnoses.map((dx) => (
                      <MenuItem key={dx.code} value={dx.code}>
                        {dx.code} {dx.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddDiagnosis}
                    sx={{
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 'normal',
                    }}
                  >
                    Add Additional Dx (optional)
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="notes"
                  label="Notes (optional)"
                  multiline
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  Ordering provider: {providerName}
                </Typography>
              </Grid>

              <Grid item xs={12} sx={{ mt: 3 }}>
                <Stack direction="row" spacing={2} justifyContent="space-between">
                  <Button
                    variant="outlined"
                    onClick={handleBack}
                    sx={{
                      borderRadius: '50px',
                      px: 4,
                      py: 1,
                    }}
                  >
                    Cancel
                  </Button>
                  <Box>
                    <Button
                      variant="contained"
                      onClick={handleOrderAndPrint}
                      disabled={!selectedTest || !selectedCptCode || selectedDiagnoses.length === 0}
                      sx={{
                        borderRadius: '50px',
                        px: 4,
                        py: 1,
                        mr: 2,
                      }}
                    >
                      Order & Print Label
                    </Button>
                    <Button
                      variant="contained"
                      type="submit"
                      disabled={!selectedTest || !selectedCptCode || selectedDiagnoses.length === 0}
                      sx={{
                        borderRadius: '50px',
                        px: 4,
                        py: 1,
                      }}
                    >
                      Order
                    </Button>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </form>
        )}
      </Paper>
    </Box>
  );
};
