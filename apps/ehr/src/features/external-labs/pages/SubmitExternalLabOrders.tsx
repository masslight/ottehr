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
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppointmentStore, useGetIcd10Search, useDebounce } from '../../../telemed';
import { getSelectors } from '../../../shared/store/getSelectors';
import { DiagnosisDTO, isLocationVirtual } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { ServiceRequest, Location, Specimen, QuestionnaireResponse, Task } from 'fhir/r4b';
import { sortLocationsByLabel } from '../../../helpers';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { DateTime } from 'luxon';
import Oystehr from '@oystehr/sdk';

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
  const [dxValue, setDxValue] = useState<DiagnosisDTO | undefined>(undefined);
  const [dxInput, setDxInput] = useState<string>('');
  const [office, setOffice] = useState<Location | undefined>(undefined);
  // this is really lab + test i think (oystehr lab orderable item)
  // these will be loaded up from an a call to the oystehr labs service?
  const [lab, setLab] = useState('');
  const [notes, setNotes] = useState<string>('');

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

  useEffect(() => {
    if (diagnosis) {
      const primaryDiagnosis = diagnosis.find((d) => d.isPrimary);
      if (primaryDiagnosis) setDxValue(primaryDiagnosis);
    }
  }, [diagnosis]);

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

  useEffect(() => {
    if (location) {
      setOffice(location);
    }
  }, [location]);

  const locationOptions = useMemo(() => {
    const allLocations = locations.map((location) => {
      return { label: `${location.address?.state?.toUpperCase()} - ${location.name}`, value: location.id };
    });

    return sortLocationsByLabel(allLocations as { label: string; value: string }[]);
  }, [locations]);

  const handleOfficeChange = (e: SelectChangeEvent<string>): void => {
    const selectedLocation = locations.find((locationTemp) => locationTemp.id === e.target.value);
    console.log('selected location in handle location change', selectedLocation);
    setOffice(selectedLocation);
  };

  // not sure if we should handle creating resources on the front end or the back end
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setSubmitting(true);
    // todo add some error handling / modal popup in the event there is an issue creating the resources

    // todo finish mapping the missing attributes below
    // fhir resources to be created upon submit
    const serviceRequestConfig: ServiceRequest = {
      // SR mappings missing
      // insurance (pending finalization on converting paperwork to coverage)
      // performer
      // specimen (maybe add later? need to see if can handle within the same transaction)
      // supportingInfo (maybe add later? need to see if can handle within the same transaction)
      // code (think this is dependent on what we get back from oystehr labs)
      // instantiatesCanonical (skipping atm)
      // contained (skipping atm)
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      subject: {
        reference: `Patient/${patientId}`,
      },
      encounter: {
        reference: `Encounter/${encounter.id}`,
      },
      requester: {
        reference: `Practitioner/${practitionerId}`,
      },
      priority: 'routine',
      note: [
        {
          text: notes,
        },
      ],
      reasonCode: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: dxValue?.code,
            },
          ],
          text: dxValue?.display,
        },
      ],
    };
    const specimenConfig: Specimen = {
      // Specimen mappings missing
      // request (will be a ref to the above SR)
      resourceType: 'Specimen',
      extension: [
        {
          url: 'specimen-defintion',
          valueString: 'placeholder', // this will come from the oi.specimen returned from oystehr labs
        },
      ],
    };
    // only create if selected lab has an aoe create a QR for the linked Questionnaire
    const aoeQRConfig: QuestionnaireResponse = {
      // QR mappings missing
      // basedOn (will be a ref to the above SR)
      resourceType: 'QuestionnaireResponse',
      questionnaire: `Questionnaire/`,
      encounter: {
        reference: `Encounter/${encounter.id}`,
      },
      status: 'in-progress',
    };
    const preSubmissionTaskConfig: Task = {
      // Task mappings missing
      // basedOn (will be a ref to the above SR)
      // input (skipping atm)
      // code (skipping atm)
      resourceType: 'Task',
      intent: 'order',
      encounter: {
        reference: `Encounter/${encounter.id}`,
      },
      location: {
        reference: `Location/${office?.id}`,
      },
      status: 'ready',
      authoredOn: DateTime.now().toISO() || undefined,
    };
    console.log('check me', serviceRequestConfig, specimenConfig, aoeQRConfig, preSubmissionTaskConfig);

    setSubmitting(false);
    // redirect back the the sent out labs page
    navigate(`/in-person/${appointment?.id}/external-lab-orders`);
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
            <Grid container sx={{ width: '100%' }} spacing={1}>
              <Grid item xs={12}>
                <Autocomplete
                  id="select-dx"
                  fullWidth
                  noOptionsText={
                    debouncedSearchTerm && icdSearchOptions.length === 0
                      ? 'Nothing found for this search criteria'
                      : 'Start typing to load results'
                  }
                  inputValue={dxInput}
                  onInputChange={(event, newInputValue) => {
                    setDxInput(newInputValue);
                  }}
                  value={dxValue || (null as unknown as undefined)}
                  isOptionEqualToValue={(option, value) => value.code === option.code}
                  onChange={(event: any, newValue: any) => {
                    setDxValue(newValue);
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
                      label="DX"
                    />
                  )}
                />
              </Grid>
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
                <TextField
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  sx={{ width: '100%' }}
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
            </Grid>
          </Paper>
        </form>
      )}
    </Stack>
  );
};
