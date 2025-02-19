import {
  Typography,
  Stack,
  useTheme,
  Paper,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Grid,
  TextField,
  CircularProgress,
  SelectChangeEvent,
  Autocomplete,
  Button,
  Switch,
  FormControlLabel,
  Box,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssessmentTitle } from '../../../telemed/features/appointment/AssessmentTab';
import { useAppointmentStore, useGetIcd10Search, useDebounce, ActionsList, DeleteIconButton } from '../../../telemed';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO, isLocationVirtual } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { Location } from 'fhir/r4b';
import { sortLocationsByLabel } from '../../../helpers';
import useEvolveUser from '../../../hooks/useEvolveUser';
import Oystehr from '@oystehr/sdk';
// import { submitLabOrder } from '../../../api/api';
// import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';

interface SubmitExternalLabOrdersProps {
  appointmentID?: string;
}

export const SubmitExternalLabOrders: React.FC<SubmitExternalLabOrdersProps> = () => {
  const theme = useTheme();
  const { oystehr } = useApiClients();
  const user = useEvolveUser();
  const navigate = useNavigate();
  const practitionerId = user?.profile.replace('Practitioner/', '');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [orderDxPrimary, setOrderDxPrimary] = useState<DiagnosisDTO | undefined>(undefined);
  const [orderDxSecondary, setOrderDxSecondary] = useState<DiagnosisDTO[]>([]);
  const [office, setOffice] = useState<Location | undefined>(undefined);
  const [pscHold, setPscHold] = useState<boolean>(true); // defaulting & locking to true for mvp
  // this is really lab + test i think (oystehr lab orderable item)
  // these will be loaded up from an a call to the oystehr labs service?
  const [lab, setLab] = useState('');
  // const [error, setError] = useState<string | undefined>(undefined);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'ICD10CM' });
  const icdSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const { chartData, location, encounter, appointment } = getSelectors(useAppointmentStore, [
    'chartData',
    'location',
    'encounter',
    'appointment',
  ]);
  const { diagnosis, patientId } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);

  useEffect(() => {
    if (primaryDiagnosis) {
      setOrderDxPrimary(primaryDiagnosis);
    }
  }, [primaryDiagnosis]);

  useEffect(() => {
    if (location) {
      setOffice(location);
    }
  }, [location]);

  useEffect(() => {
    async function getLocationsResults(oystehr: Oystehr): Promise<void> {
      if (!oystehr) {
        return;
      }

      setLoading(true);

      try {
        let locationsResults = (
          await oystehr.fhir.search<Location>({
            resourceType: 'Location',
            params: [{ name: '_count', value: '1000' }],
          })
        ).unbundle();
        locationsResults = locationsResults.filter((loc) => !isLocationVirtual(loc));
        setLocations(locationsResults);
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setLoading(false);
      }
    }

    if (oystehr && locations.length === 0) {
      void getLocationsResults(oystehr);
    }
  }, [oystehr, loading, locations.length]);

  const addDxToOrder = (dx: DiagnosisDTO): void => {
    if (dx.code === primaryDiagnosis?.code) {
      if (!orderDxPrimary) setOrderDxPrimary(dx);
    } else if (!orderDxSecondary.find((tempdx) => tempdx.code === dx.code)) {
      setOrderDxSecondary([...orderDxSecondary, dx]);
    }
  };

  const removeDxFromOrder = (dx: DiagnosisDTO, type: 'Primary' | 'Secondary'): void => {
    if (type === 'Primary') {
      setOrderDxPrimary(undefined);
    } else {
      const updatedDx = orderDxSecondary.filter((dxVal) => dxVal.code !== dx.code);
      setOrderDxSecondary(updatedDx);
    }
  };

  const locationOptions = useMemo(() => {
    const allLocations = locations.map((location) => {
      return { label: `${location.address?.state?.toUpperCase()} - ${location.name}`, value: location.id };
    });

    return sortLocationsByLabel(allLocations as { label: string; value: string }[]);
  }, [locations]);

  const handleOfficeChange = (e: SelectChangeEvent<string>): void => {
    const selectedLocation = locations.find((locationTemp) => locationTemp.id === e.target.value);
    setOffice(selectedLocation);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    console.log('check submit params', patientId, office, practitionerId);
    console.log('encounter', encounter);
    // if (oystehrZambda && dxValue && patientId && office && practitionerId) {
    //   try {
    //     const res = await submitLabOrder(oystehrZambda, {
    //       dx: dxValue,
    //       patientId,
    //       encounter,
    //       location: office,
    //       practitionerId,
    //     });
    //     console.log('res', res);
    //     navigate(`/in-person/${appointment?.id}/external-lab-orders`);
    //   } catch (e) {
    //     const oysterError = e as OystehrSdkError;
    //     setError(oysterError?.message || 'error ordering lab');
    //   }
    // }
    setSubmitting(false);
  };

  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
        Send Out Lab Order
      </Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <form onSubmit={handleSubmit}>
          <Paper sx={{ p: 3 }}>
            <Grid container sx={{ width: '100%' }} spacing={1} rowSpacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                  Dx
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="select-dx-label" shrink>
                    Dx
                  </InputLabel>
                  <Select
                    notched
                    fullWidth
                    id="select-dx"
                    label="Dx"
                    onChange={(e) => {
                      const selectedDxCode = e.target.value;
                      const selectedDx = diagnosis?.find((tempDx) => tempDx.code === selectedDxCode);
                      if (selectedDx) addDxToOrder(selectedDx);
                    }}
                    displayEmpty
                    value=""
                    sx={{
                      '& .MuiInputLabel-root': {
                        top: -8,
                      },
                    }}
                  >
                    <MenuItem value="" disabled>
                      <Typography sx={{ color: '#9E9E9E' }}>Add a Dx to Order</Typography>
                    </MenuItem>
                    {diagnosis?.map((d) => (
                      <MenuItem id={d.resourceId} key={d.resourceId} value={d.code}>
                        {d.code} {d.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  blurOnSelect
                  id="select-additional-dx"
                  fullWidth
                  noOptionsText={
                    debouncedSearchTerm && icdSearchOptions.length === 0
                      ? 'Nothing found for this search criteria'
                      : 'Start typing to load results'
                  }
                  value={null}
                  isOptionEqualToValue={(option, value) => value.code === option.code}
                  onChange={(event: any, newValue: any) => {
                    addDxToOrder(newValue);
                  }}
                  loading={isSearching}
                  options={icdSearchOptions}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : `${option.code} ${option.display}`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      onChange={(e) => debouncedHandleInputChange(e.target.value)}
                      label="Additional Dx"
                      placeholder="Search for Dx if not on list above"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                {orderDxPrimary && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <AssessmentTitle>Primary *</AssessmentTitle>
                    <ActionsList
                      data={[orderDxPrimary]}
                      getKey={(value, index) => value.resourceId || index}
                      renderItem={(value) => (
                        <Typography>
                          {value.display} {value.code}
                        </Typography>
                      )}
                      renderActions={(value) => (
                        <DeleteIconButton disabled={loading} onClick={() => removeDxFromOrder(value, 'Primary')} />
                      )}
                    />
                  </Box>
                )}
              </Grid>
              {orderDxSecondary.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <AssessmentTitle>Secondary</AssessmentTitle>
                    <ActionsList
                      data={orderDxSecondary}
                      getKey={(value, index) => value.resourceId || index}
                      renderItem={(value) => (
                        <Typography>
                          {value.display} {value.code}
                        </Typography>
                      )}
                      renderActions={(value) => (
                        <DeleteIconButton disabled={loading} onClick={() => removeDxFromOrder(value, 'Secondary')} />
                      )}
                    />
                  </Box>
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="select-office-label">Office</InputLabel>
                  <Select
                    required
                    labelId="select-office-label"
                    id="select-office"
                    label="Office"
                    value={office?.id || ''}
                    onChange={handleOfficeChange}
                  >
                    {locationOptions.map((d) => (
                      <MenuItem id={d.value} key={d.value} value={d.value}>
                        {d.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="lab-label">Lab</InputLabel>
                  {/* todo placeholder fake lab / test list  */}
                  <Select
                    required
                    labelId="lab-label"
                    id="lab"
                    label="Lab"
                    value={lab}
                    onChange={(e) => setLab(e.target.value)}
                  >
                    {['strep/quest', 'strep/labcorp', 'mumps/quest'].map((d) => (
                      <MenuItem key={d} value={d}>
                        {d}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                {/* disabling this field as we are only allowing psc hold orders for mvp */}
                <FormControlLabel
                  control={<Switch checked={pscHold} onChange={() => setPscHold(!pscHold)} disabled />}
                  label="PSC Hold"
                />
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                  onClick={() => {
                    navigate(`/in-person/${appointment?.id}/external-lab-orders`);
                  }}
                >
                  Cancel
                </Button>
              </Grid>
              <Grid item xs={6} display="flex" justifyContent="flex-end">
                <LoadingButton
                  loading={submitting}
                  type="submit"
                  variant="contained"
                  sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
                >
                  Order
                </LoadingButton>
                {/* {error && (
                  <Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }}>
                    <Typography sx={{ color: theme.palette.error.main }}>{error}</Typography>
                  </Grid>
                )} */}
              </Grid>
            </Grid>
          </Paper>
        </form>
      )}
    </Stack>
  );
};
