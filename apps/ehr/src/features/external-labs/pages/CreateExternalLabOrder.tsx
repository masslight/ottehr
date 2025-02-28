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
import { useAppointmentStore, useGetIcd10Search, useDebounce, ActionsList, DeleteIconButton } from '../../../telemed';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO, isLocationVirtual, OrderableItemSearchResult } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { Location } from 'fhir/r4b';
import { sortLocationsByLabel } from '../../../helpers';
import useEvolveUser from '../../../hooks/useEvolveUser';
import Oystehr from '@oystehr/sdk';
import { LabsAutocomplete } from '../components/LabsAutocomplete';
import { createLabOrder } from '../../../api/api';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';

interface SubmitExternalLabOrdersProps {
  appointmentID?: string;
}

export const CreateExternalLabOrder: React.FC<SubmitExternalLabOrdersProps> = () => {
  const theme = useTheme();
  const { oystehr, oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const navigate = useNavigate();
  const practitionerId = user?.profile.replace('Practitioner/', '');
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>([]);
  const [selectedLab, setSelectedLab] = useState<OrderableItemSearchResult | null>(null);
  const [office, setOffice] = useState<Location | undefined>(undefined);
  const [pscHold, setPscHold] = useState<boolean>(true); // defaulting & locking to true for mvp
  const [error, setError] = useState<string | undefined>(undefined);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'ICD10CM' });
  const icdSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const { chartData, location, encounter, appointment, coverage, coverageName } = getSelectors(useAppointmentStore, [
    'chartData',
    'location',
    'encounter',
    'appointment',
    'coverage',
    'coverageName',
  ]);
  const { diagnosis, patientId } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);

  useEffect(() => {
    if (primaryDiagnosis) {
      setOrderDx([primaryDiagnosis]);
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

      setLoadingLocations(true);

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
        setLoadingLocations(false);
      }
    }

    if (oystehr && locations.length === 0) {
      void getLocationsResults(oystehr);
    }
  }, [oystehr, loadingLocations, locations.length]);

  const addDxToOrder = (dx: DiagnosisDTO): void => {
    if (!orderDx.find((tempdx) => tempdx.code === dx.code)) {
      setOrderDx([...orderDx, dx]);
    }
  };

  const removeDxFromOrder = (dx: DiagnosisDTO): void => {
    const updatedDx = orderDx.filter((dxVal) => dxVal.code !== dx.code);
    setOrderDx(updatedDx);
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
    const paramsSatisfied = orderDx.length && patientId && office && practitionerId && selectedLab && coverage;
    if (oystehrZambda && paramsSatisfied) {
      try {
        await createLabOrder(oystehrZambda, {
          dx: orderDx,
          patientId,
          encounter,
          coverage,
          location: office,
          practitionerId,
          orderableItem: selectedLab,
          pscHold,
        });
        navigate(`/in-person/${appointment?.id}/external-lab-orders`);
      } catch (e) {
        const oysterError = e as OystehrSdkError;
        setError(oysterError?.message || 'error ordering lab');
      }
    } else if (!paramsSatisfied) {
      console.log('missing required params');
    }
    setSubmitting(false);
  };

  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
        Order Lab
      </Typography>
      {loadingLocations ? (
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
                    size="small"
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
                  size="small"
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
                      onChange={(e) => debouncedHandleInputChange(e.target.value)}
                      label="Additional Dx"
                      placeholder="Search for Dx if not on list above"
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
              {orderDx.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <ActionsList
                      data={orderDx}
                      getKey={(value, index) => value.resourceId || index}
                      renderItem={(value) => (
                        <Typography>
                          {value.display} {value.code}
                        </Typography>
                      )}
                      renderActions={(value) => <DeleteIconButton onClick={() => removeDxFromOrder(value)} />}
                    />
                  </Box>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                  Office
                </Typography>
                <Box sx={{ paddingTop: '8px' }}>
                  <FormControl fullWidth size="small">
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
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                  Patient insurance
                </Typography>
                <Typography variant="body2" sx={{ paddingTop: '8px' }}>
                  {coverageName}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                  Lab
                </Typography>
                <LabsAutocomplete selectedLab={selectedLab} setSelectedLab={setSelectedLab}></LabsAutocomplete>
              </Grid>
              <Grid item xs={12}>
                {/* disabling this field as we are only allowing psc hold orders for mvp */}
                <FormControlLabel
                  sx={{ fontSize: '14px' }}
                  control={<Switch checked={pscHold} onChange={() => setPscHold(!pscHold)} disabled />}
                  label={<Typography variant="body2">PSC Hold</Typography>}
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
              </Grid>
              {error && (
                <Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }}>
                  <Typography sx={{ color: theme.palette.error.main }}>{error}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </form>
      )}
    </Stack>
  );
};
