import React, { useEffect, useRef, useState } from 'react';
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
  Autocomplete,
  useTheme,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data';
import { PRACTITIONER_CODINGS, TestItem } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { createInHouseLabOrder, getCreateInHouseLabOrderResources, getOrCreateVisitLabel } from '../../../api/api';
import { useGetIcd10Search, useDebounce, ActionsList, DeleteIconButton } from '../../../telemed';
import { enqueueSnackbar } from 'notistack';

export const InHouseLabOrderCreatePage: React.FC = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableTests, setAvailableTests] = useState<TestItem[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [availableCptCodes, setAvailableCptCodes] = useState<string[]>([]);
  const [selectedCptCode, setSelectedCptCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const [error, setError] = useState<string[] | undefined>(undefined);

  const { chartData, encounter, appointment } = getSelectors(useAppointmentStore, [
    'chartData',
    'encounter',
    'appointment',
  ]);

  const { diagnosis = [] } = chartData || {};
  const didPrimaryDiagnosisInit = useRef(false);

  // already added diagnoses, the may have "added via lab order" flag with true and false value
  // so, the select "select dx" will show all diagnoses which are showed in the Assessment page no matter what source they have
  const [selectedAssessmentDiagnoses, setSelectedAssessmentDiagnoses] = useState<DiagnosisDTO[]>([]);

  // new diagnoses, the will have "added via lab order" flag with true value,
  // and they will be linked to appointment resources in the create-in-house-lab-order zambda
  const [selectedNewDiagnoses, setSelectedNewDiagnoses] = useState<DiagnosisDTO[]>([]);

  // init selectedAssessmentDiagnoses with primary diagnosis
  useEffect(() => {
    if (didPrimaryDiagnosisInit.current) {
      return;
    }
    const primaryDiagnosis = [chartData?.diagnosis?.find((d) => d.isPrimary)].filter((d): d is DiagnosisDTO => !!d);

    if (primaryDiagnosis.length && !selectedAssessmentDiagnoses.length) {
      setSelectedAssessmentDiagnoses(primaryDiagnosis);
      didPrimaryDiagnosisInit.current = true;
    }
  }, [chartData?.diagnosis, selectedAssessmentDiagnoses]);

  // used to fetch dx icd10 codes
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'ICD10CM' });
  const icdSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const attendingPractitioner = encounter?.participant?.find(
    (participant) =>
      participant.type?.find((type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system))
  );

  useEffect(() => {
    if (!oystehrZambda) {
      return;
    }

    const fetchLabs = async (): Promise<void> => {
      try {
        if (!encounter?.id) {
          console.error('Encounter not found');
          return;
        }
        setLoading(true);
        const response = await getCreateInHouseLabOrderResources(oystehrZambda, {
          encounterId: encounter.id,
        });
        const testItems = Object.values(response.labs || {});
        setAvailableTests(testItems.sort((a, b) => a.name.localeCompare(b.name)));
        setProviderName(response.providerName);
      } catch (error) {
        console.error('Error fetching labs:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchLabs();
  }, [oystehrZambda, encounter?.id]);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent, shouldPrintLabel = false): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    const encounterId = encounter.id;
    const canBeSubmitted =
      encounterId &&
      selectedTest &&
      selectedCptCode &&
      (selectedAssessmentDiagnoses.length || selectedNewDiagnoses.length);

    if (oystehrZambda && canBeSubmitted) {
      try {
        const res = await createInHouseLabOrder(oystehrZambda, {
          encounterId,
          testItem: selectedTest,
          cptCode: selectedCptCode,
          diagnosesAll: [...selectedAssessmentDiagnoses, ...selectedNewDiagnoses],
          diagnosesNew: selectedNewDiagnoses,
          notes: notes,
        });

        if (shouldPrintLabel) {
          const labelPdfs = await getOrCreateVisitLabel(oystehrZambda, { encounterId });

          if (labelPdfs.length !== 1) {
            setError(['Expected 1 label pdf, received unexpected number']);
          }

          const labelPdf = labelPdfs[0];
          window.open(labelPdf.presignedURL, '_blank');
        }

        if (res.serviceRequestId) {
          navigate(`/in-person/${appointment?.id}/in-house-lab-orders/${res.serviceRequestId}/order-details`);
        }
      } catch (e) {
        console.error(e);
        setError(['There was an error creating this lab order']);
      } finally {
        setLoading(false);
      }
    } else if (!canBeSubmitted) {
      const errorMessage: string[] = [];
      if (!selectedAssessmentDiagnoses.length && !selectedNewDiagnoses.length)
        errorMessage.push('Please enter at least one dx');
      if (!selectedTest) errorMessage.push('Please select a test to order');
      if (!attendingPractitioner) errorMessage.push('No attending practitioner has been assigned to this encounter');
      if (errorMessage.length === 0) errorMessage.push('There was an error creating this lab order');
      setError(errorMessage);
    }
  };

  const handleTestSelection = (selectedTest: string): void => {
    if (!availableTests?.length) {
      return;
    }

    const foundEntry = availableTests.find((test) => test.name === selectedTest);

    if (!foundEntry) {
      return;
    }

    setSelectedTest(foundEntry);
    setSelectedCptCode('');
    setAvailableCptCodes(foundEntry.cptCode);
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
                <FormControl
                  fullWidth
                  required
                  sx={{
                    '& .MuiInputBase-root': {
                      height: '40px',
                    },
                    '& .MuiSelect-select': {
                      display: 'flex',
                      alignItems: 'center',
                      paddingTop: 0,
                      paddingBottom: 0,
                    },
                  }}
                >
                  <InputLabel
                    id="test-type-label"
                    sx={{
                      transform: 'translate(14px, 10px) scale(1)',
                      '&.MuiInputLabel-shrink': {
                        transform: 'translate(14px, -9px) scale(0.75)',
                      },
                    }}
                  >
                    Test
                  </InputLabel>
                  <Select
                    labelId="test-type-label"
                    id="test-type"
                    value={selectedTest?.name || ''}
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
                  <FormControl
                    fullWidth
                    required
                    sx={{
                      '& .MuiInputBase-root': {
                        height: '40px',
                      },
                      '& .MuiSelect-select': {
                        display: 'flex',
                        alignItems: 'center',
                        paddingTop: 0,
                        paddingBottom: 0,
                      },
                    }}
                  >
                    <InputLabel
                      id="cpt-code-label"
                      sx={{
                        transform: 'translate(14px, 10px) scale(1)',
                        '&.MuiInputLabel-shrink': {
                          transform: 'translate(14px, -9px) scale(0.75)',
                        },
                      }}
                    >
                      CPT code
                    </InputLabel>
                    <Select
                      labelId="cpt-code-label"
                      id="cpt-code"
                      value={selectedCptCode}
                      label="CPT code*"
                      onChange={(e) => setSelectedCptCode(e.target.value)}
                      size="small"
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
                <FormControl
                  fullWidth
                  sx={{
                    '& .MuiInputBase-root': {
                      height: '40px',
                    },
                    '& .MuiSelect-select': {
                      display: 'flex',
                      alignItems: 'center',
                      paddingTop: 0,
                      paddingBottom: 0,
                    },
                  }}
                >
                  <InputLabel
                    id="diagnosis-label"
                    sx={{
                      transform: 'translate(14px, 10px) scale(1)',
                      '&.MuiInputLabel-shrink': {
                        transform: 'translate(14px, -9px) scale(0.75)',
                      },
                    }}
                  >
                    Select Dx
                  </InputLabel>
                  <Select
                    labelId="diagnosis-label"
                    id="diagnosis"
                    multiple
                    value={selectedAssessmentDiagnoses.map((dx) => dx.code)}
                    label="Select Dx"
                    onChange={(e) => {
                      const dxCodesFromSelect = Array.isArray(e.target.value) ? e.target.value : [e.target.value];

                      const diagnosesFomSelect = dxCodesFromSelect
                        .map((code) => diagnosis.find((dx) => dx.code === code))
                        .filter((dx): dx is DiagnosisDTO => Boolean(dx));

                      setSelectedAssessmentDiagnoses([...diagnosesFomSelect]);
                    }}
                    renderValue={(selected) => {
                      if (selected.length === 0) {
                        return <em>Select diagnoses</em>;
                      }
                      return selected.map((code) => {
                        const dx = diagnosis.find((d) => d.code === code);
                        return dx ? <Chip key={dx.code} size="small" label={`${dx.code} ${dx.display}`} /> : code;
                      });
                    }}
                  >
                    {diagnosis?.map((dx) => (
                      <MenuItem key={dx.code} value={dx.code}>
                        {dx.code} {dx.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  blurOnSelect
                  id="select-additional-dx"
                  size="small"
                  fullWidth
                  noOptionsText={
                    debouncedSearchTerm && icdSearchOptions.length === 0
                      ? 'Nothing found for this search criteria'
                      : 'Start typing to load results'
                  }
                  value={null}
                  isOptionEqualToValue={(option, value) => value.code === option.code}
                  onChange={(_event, selectedDx) => {
                    if (!selectedDx) {
                      return;
                    }
                    const alreadySelected = selectedNewDiagnoses.find((tempdx) => tempdx.code === selectedDx?.code);
                    if (!alreadySelected) {
                      setSelectedNewDiagnoses((diagnoses) => [
                        ...diagnoses,
                        { ...selectedDx, addedViaLabOrder: true, isPrimary: false },
                      ]);
                    } else {
                      enqueueSnackbar('This Dx is already added to the order', {
                        variant: 'error',
                      });
                    }
                  }}
                  loading={isSearching}
                  options={icdSearchOptions}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : `${option.code} ${option.display}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      onChange={(e) => debouncedHandleInputChange(e.target.value)}
                      label="Additional Dx"
                      placeholder="Search for Dx if not on list above"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>

              {(selectedAssessmentDiagnoses.length > 0 || selectedNewDiagnoses.length > 0) && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <ActionsList
                      data={selectedAssessmentDiagnoses}
                      getKey={(value, index) => value.resourceId || index}
                      renderItem={(value) => (
                        <Typography>
                          {value.display} {value.code}
                        </Typography>
                      )}
                      renderActions={(value) => (
                        <DeleteIconButton
                          onClick={() =>
                            setSelectedAssessmentDiagnoses((diagnoses) =>
                              diagnoses.filter((dxVal) => dxVal.code !== value.code)
                            )
                          }
                        />
                      )}
                    />
                    <ActionsList
                      data={selectedNewDiagnoses}
                      getKey={(value, index) => value.resourceId || index}
                      renderItem={(value) => (
                        <Typography>
                          {value.display} {value.code}
                        </Typography>
                      )}
                      renderActions={(value) => (
                        <DeleteIconButton
                          onClick={() =>
                            setSelectedNewDiagnoses((diagnoses) =>
                              diagnoses.filter((dxVal) => dxVal.code !== value.code)
                            )
                          }
                        />
                      )}
                    />
                  </Box>
                </Grid>
              )}

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

              {providerName && (
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ mt: 2 }}>
                    Ordering provider: {providerName}
                  </Typography>
                </Grid>
              )}

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
                      onClick={(e) => handleSubmit(e, true)}
                      disabled={
                        !selectedTest ||
                        !selectedCptCode ||
                        (selectedAssessmentDiagnoses.length === 0 && selectedNewDiagnoses.length === 0)
                      }
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
                      disabled={
                        !selectedTest ||
                        !selectedCptCode ||
                        (selectedAssessmentDiagnoses.length === 0 && selectedNewDiagnoses.length === 0)
                      }
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
              {error &&
                error.length > 0 &&
                error.map((msg, idx) => (
                  <Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                    <Typography sx={{ color: theme.palette.error.main }}>
                      {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                    </Typography>
                  </Grid>
                ))}
            </Grid>
          </form>
        )}
      </Paper>
    </Box>
  );
};
