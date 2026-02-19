import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { LabSets } from 'src/features/external-labs/components/LabSets';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useMainEncounterChartData } from 'src/features/visits/shared/hooks/useMainEncounterChartData';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  useGetCreateInHouseLabResources,
  useICD10SearchNew,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { getAttendingPractitionerId, isApiError, LabListsDTO, LabType, TestItem } from 'utils';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data';
import { createInHouseLabOrder, getOrCreateVisitLabel } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { InHouseLabsNotesCard } from '../components/details/InHouseLabsNotesCard';
import { InHouseLabsBreadcrumbs } from '../components/InHouseLabsBreadcrumbs';

export const InHouseLabOrderCreatePage: React.FC = () => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string[] | undefined>(undefined);

  const apiClient = useOystehrAPIClient();

  const prefillData = location.state as {
    testItemName?: string;
    diagnoses?: DiagnosisDTO[];
    type?: 'repeat' | 'reflex';
  };

  const { encounter, appointment } = useAppointmentData();
  const { chartData, setPartialChartData } = useChartData();
  const didPrimaryDiagnosisInit = useRef(false);
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';
  const { data: mainEncounterChartData } = useMainEncounterChartData(isFollowup);

  const diagnosis = useMemo<DiagnosisDTO[]>(
    () => (isFollowup ? mainEncounterChartData?.diagnosis || [] : chartData?.diagnosis || []),
    [mainEncounterChartData?.diagnosis, chartData?.diagnosis, isFollowup]
  );

  // already added diagnoses may have "added via in-house lab order" flag with true and false values
  // so, the "select dx" dropdown will show all diagnoses that are displayed on the Assessment page regardless of their source
  const [selectedAssessmentDiagnoses, setSelectedAssessmentDiagnoses] = useState<DiagnosisDTO[]>([]);

  // new diagnoses, the will have "added via in-house lab order" flag with true value,
  // and they will be linked to appointment resources in the create-in-house-lab-order zambda
  const [selectedNewDiagnoses, setSelectedNewDiagnoses] = useState<DiagnosisDTO[]>([]);

  // init selectedAssessmentDiagnoses with primary diagnosis from main encounter
  useEffect(() => {
    if (didPrimaryDiagnosisInit.current) {
      return;
    }
    const primaryDiagnosis = [diagnosis.find((d) => d.isPrimary)].filter((d): d is DiagnosisDTO => !!d);

    if (primaryDiagnosis.length && !selectedAssessmentDiagnoses.length) {
      setSelectedAssessmentDiagnoses(primaryDiagnosis);
      didPrimaryDiagnosisInit.current = true;
    }
  }, [diagnosis, selectedAssessmentDiagnoses]);

  // used to fetch dx icd10 codes
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useICD10SearchNew({ search: debouncedSearchTerm });
  const icdSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const attendingPractitionerId = getAttendingPractitionerId(encounter);

  const { data: createInHouseLabResources } = useGetCreateInHouseLabResources({
    encounterId: encounter?.id,
  });

  const availableTests = Object.values(createInHouseLabResources?.labs || {});
  const providerName = createInHouseLabResources?.providerName ?? '';
  const labSets = createInHouseLabResources?.labSets;

  useEffect(() => {
    if (prefillData) {
      const { testItemName, diagnoses } = prefillData;
      if (testItemName) {
        const found = availableTests.find((test) => test.name === testItemName);
        if (found) {
          if (prefillData.type === 'repeat') {
            found.orderedAsRepeat = true;
          }
          setSelectedTests([found]);
        }
      }
      if (diagnoses) {
        setSelectedAssessmentDiagnoses(diagnoses);
      }
    }
  }, [prefillData, availableTests]);

  const handleBack = (): void => {
    navigate(-1);
  };

  const canBeSubmitted = !!(encounter?.id && selectedTests.length > 0);

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent, shouldPrintLabel = false): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    const GENERIC_ERROR_MSG = 'There was an error creating in-house lab order';
    if (oystehrZambda && canBeSubmitted) {
      try {
        const res = await createInHouseLabOrder(oystehrZambda, {
          encounterId: encounter.id!,
          testItems: selectedTests,
          diagnosesAll: [...selectedAssessmentDiagnoses, ...selectedNewDiagnoses],
          diagnosesNew: selectedNewDiagnoses,
          notes: notes,
        });

        let savedDiagnoses: DiagnosisDTO[] = [];

        try {
          savedDiagnoses = res?.saveChartDataResponse?.output?.chartData?.diagnosis || [];
        } catch (error) {
          console.error('Failed to extract diagnosis from response:', error);
        }

        // update chart data local state with new diagnoses after successful creation to see actual diagnoses in the Assessment page
        if (!isFollowup) {
          setPartialChartData({
            diagnosis: [...diagnosis, ...savedDiagnoses],
          });
        }

        if (shouldPrintLabel) {
          const labelPdfs = await getOrCreateVisitLabel(oystehrZambda, { encounterId: encounter.id! });

          if (labelPdfs.length !== 1) {
            setError(['Expected 1 label pdf, received unexpected number']);
          }

          const labelPdf = labelPdfs[0];
          window.open(labelPdf.presignedURL, '_blank');
        }

        if (res.serviceRequestIds.length === 1) {
          // we will only nav forward if one test was created, else we will direct the user back to the table
          navigate(`/in-person/${appointment?.id}/in-house-lab-orders/${res.serviceRequestIds[0]}/order-details`);
        } else {
          navigate(`/in-person/${appointment?.id}/in-house-lab-orders`);
        }
      } catch (e) {
        const sdkError = e as Oystehr.OystehrSdkError;
        console.error('error creating in house lab order', sdkError.code, sdkError.message);
        if (isApiError(sdkError)) {
          console.log('is api error');
          setError([sdkError.message || GENERIC_ERROR_MSG]);
        } else {
          setError([GENERIC_ERROR_MSG]);
        }
      } finally {
        setLoading(false);
      }
    } else if (!canBeSubmitted) {
      const errorMessage: string[] = [];
      if (!selectedTests.length) errorMessage.push('Please select a test to order');
      if (!attendingPractitionerId) errorMessage.push('No attending practitioner has been assigned to this encounter');
      if (errorMessage.length === 0) errorMessage.push(GENERIC_ERROR_MSG);
      setError(errorMessage);
      setLoading(false);
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

    const alreadySelected = selectedTests.find((tempLab) => {
      return tempLab.name === selectedTest;
    });

    if (!alreadySelected) {
      setSelectedTests([...selectedTests, foundEntry]);
    } else {
      enqueueSnackbar('This lab has already been selected', {
        variant: 'error',
      });
    }
  };

  const handleSetSelectedLabsViaLabSets = async (labSet: LabListsDTO): Promise<void> => {
    if (labSet.listType === LabType.inHouse) {
      const res = await apiClient?.getCreateInHouseLabOrderResources({
        selectedLabSet: labSet,
      });
      const labs = res?.labs;

      if (labs) {
        setSelectedTests((currentLabs) => {
          const existingCodes = new Set(currentLabs.map((lab) => lab.adId));

          const newLabs = labs.filter((lab) => !existingCodes.has(lab.adId));

          return [...currentLabs, ...newLabs];
        });
      }
    }
  };

  return (
    <DetailPageContainer>
      <InHouseLabsBreadcrumbs pageName="Order In-House Lab">
        <Typography
          data-testid={dataTestIds.orderInHouseLabPage.title}
          variant="h4"
          color="primary.dark"
          sx={{ mb: 3 }}
        >
          Order In-House Lab
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
                      data-testid={dataTestIds.orderInHouseLabPage.testTypeField}
                      value=""
                      label="Test"
                      onChange={(e) => handleTestSelection(e.target.value)}
                      MenuProps={{
                        PaperProps: {
                          'data-testid': dataTestIds.orderInHouseLabPage.testTypeList,
                        },
                      }}
                    >
                      {availableTests.map((test) => (
                        <MenuItem key={`${test.name}-${test.adId}`} value={test.name}>
                          {test.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {labSets && <LabSets labSets={labSets} setSelectedLabs={handleSetSelectedLabsViaLabSets} />}

                  {selectedTests.length > 0 && (
                    <TableContainer sx={{ mb: '8px' }}>
                      <Table
                        size="small"
                        sx={{
                          '& .MuiTableCell-root': {
                            py: 0.5,
                            px: 1,
                          },
                        }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell width="35%">
                              <Typography variant="overline">Test</Typography>
                            </TableCell>
                            <TableCell width="35%">
                              <Typography variant="overline">CPT Code</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="overline">Run as repeat</Typography>
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {selectedTests.map((test) => (
                            <TableRow key={test.name}>
                              <TableCell>{test.name}</TableCell>
                              <TableCell data-testid={dataTestIds.orderInHouseLabPage.CPTCodeField}>{`${test.cptCode}${
                                test.orderedAsRepeat ? `-91 (QW)` : ''
                              }`}</TableCell>
                              <TableCell align="center">
                                {test.repeatable && (
                                  <Checkbox
                                    size="small"
                                    sx={{
                                      p: 0.5,
                                    }}
                                    checked={test.orderedAsRepeat}
                                    onChange={(e) => {
                                      const checked = e.target.checked;

                                      setSelectedTests((prev) =>
                                        prev.map((item) =>
                                          item.name === test.name ? { ...item, orderedAsRepeat: checked } : item
                                        )
                                      );
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <DeleteIconButton
                                  onClick={() =>
                                    setSelectedTests((prev) =>
                                      prev.filter((tempLab) => {
                                        const tempLabName = tempLab.name;
                                        const labName = test.name;

                                        return tempLabName !== labName;
                                      })
                                    )
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Grid>

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
                      data-testid={dataTestIds.orderInHouseLabPage.diagnosis}
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
                    filterOptions={(x) => x}
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
                      const alreadySelected =
                        selectedNewDiagnoses.find((tempDx) => tempDx.code === selectedDx?.code) ||
                        selectedAssessmentDiagnoses.find((tempDx) => tempDx.code === selectedDx?.code);
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
                        data-testid={dataTestIds.orderInHouseLabPage.additionalDx}
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

                {/* <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="notes"
                    label="Notes (optional)"
                    multiline
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Grid> */}

                <Grid item xs={12}>
                  <InHouseLabsNotesCard
                    data-testid={dataTestIds.orderInHouseLabPage.notes}
                    notes={notes}
                    notesLabel={'Notes (optional)'}
                    readOnly={false}
                    additionalBoxSxProps={{ mb: 3 }}
                    additionalTextFieldProps={{ minRows: 4 }}
                    handleNotesUpdate={(newNote: string) => setNotes(newNote)}
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
                        data-testid={dataTestIds.orderInHouseLabPage.orderAndPrintLabelButton}
                        variant="contained"
                        onClick={(e) => handleSubmit(e, true)}
                        disabled={!canBeSubmitted}
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
                        data-testid={dataTestIds.orderInHouseLabPage.orderInHouseLabButton}
                        variant="contained"
                        type="submit"
                        disabled={!canBeSubmitted}
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
      </InHouseLabsBreadcrumbs>
    </DetailPageContainer>
  );
};
