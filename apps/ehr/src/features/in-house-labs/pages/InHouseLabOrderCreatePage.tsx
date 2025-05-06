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
import { useNavigate } from 'react-router-dom';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data';

interface CptCode {
  code: string;
  description: string;
}

interface TestOption {
  name: string;
  cptCodes: CptCode[];
}

export const InHouseLabOrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableTests, _setAvailableTests] = useState<TestOption[]>([
    {
      name: 'Rapid Strep A',
      cptCodes: [{ code: '87880', description: 'Strep A antigen detection' }],
    },
    {
      name: 'COVID-19 Antigen',
      cptCodes: [{ code: '87426', description: 'COVID-19 antigen detection' }],
    },
    {
      name: 'Influenza A/B Antigen',
      cptCodes: [{ code: '87804', description: 'Influenza A/B antigen detection' }],
    },
    {
      name: 'RSV Antigen',
      cptCodes: [{ code: '87807', description: 'RSV antigen detection' }],
    },
    {
      name: 'Urine Pregnancy Test',
      cptCodes: [{ code: '81025', description: 'Urine pregnancy test' }],
    },
    {
      name: 'Hemoglobin A1c',
      cptCodes: [{ code: '83036', description: 'Hemoglobin A1c measurement' }],
    },
    {
      name: 'Glucose (POC)',
      cptCodes: [{ code: '82962', description: 'Glucose blood test' }],
    },
    {
      name: 'Lipid Panel (POC)',
      cptCodes: [{ code: '80061', description: 'Lipid panel' }],
    },
  ]);
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [selectedCptCode, setSelectedCptCode] = useState<string>('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<DiagnosisDTO[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [availableDiagnoses, _setAvailableDiagnoses] = useState<DiagnosisDTO[]>([
    { code: 'B34.9', display: 'Viral infection, unspecified', isPrimary: true },
    { code: 'J02.0', display: 'Streptococcal pharyngitis', isPrimary: true },
    { code: 'J11.1', display: 'Influenza with other respiratory manifestations', isPrimary: true },
    { code: 'Z11.59', display: 'Encounter for screening for other viral diseases', isPrimary: true },
  ]);

  const { patient, encounter } = getSelectors(useAppointmentStore, ['patient', 'encounter']);
  // const { oystehrZambda } = useApiClients();

  // todo: Get the current provider's name
  const providerName = 'Unknown Provider';

  useEffect(() => {
    // In a real implementation, this would fetch available in-house lab tests
    // from the API based on the provider's organization
    setLoading(true);
    // Mock API call
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    // When a test is selected, automatically select the first CPT code
    if (selectedTest) {
      const test = availableTests.find((test) => test.name === selectedTest);
      if (test && test.cptCodes.length > 0) {
        setSelectedCptCode(test.cptCodes[0].code);
      }
    }
  }, [selectedTest, availableTests]);

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

  const getCptCodesForSelectedTest = (): CptCode[] => {
    const test = availableTests.find((test) => test.name === selectedTest);
    return test?.cptCodes || [];
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
                  <InputLabel id="test-type-label">Test*</InputLabel>
                  <Select
                    labelId="test-type-label"
                    id="test-type"
                    value={selectedTest}
                    label="Test*"
                    onChange={(e) => setSelectedTest(e.target.value)}
                  >
                    {availableTests.map((test) => (
                      <MenuItem key={test.name} value={test.name}>
                        {test.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel id="cpt-code-label">CPT code*</InputLabel>
                  <Select
                    labelId="cpt-code-label"
                    id="cpt-code"
                    value={selectedCptCode}
                    label="CPT code*"
                    onChange={(e) => setSelectedCptCode(e.target.value)}
                    disabled={getCptCodesForSelectedTest().length <= 1}
                  >
                    {getCptCodesForSelectedTest().map((cpt) => (
                      <MenuItem key={cpt.code} value={cpt.code}>
                        {cpt.code}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

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
