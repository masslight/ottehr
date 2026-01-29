import { Autocomplete, AutocompleteRenderInputParams, TextField } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { Location, Schedule } from 'fhir/r4b';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { isLocationVirtual } from 'utils';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { dataTestIds } from '../constants/data-test-ids';
import { sortLocationsByLabel } from '../helpers';
import { useApiClients } from '../hooks/useAppClients';

export enum LocationType {
  IN_PERSON,
  VIRTUAL,
  ALL,
}

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

interface LocationSelectProps {
  location?: LocationWithWalkinSchedule | undefined;
  setLocation: (location: LocationWithWalkinSchedule | undefined) => void;
  setLocations?: (locations: LocationWithWalkinSchedule[]) => void;
  updateURL?: boolean;
  storeLocationInLocalStorage?: boolean;
  required?: boolean;
  queryParams?: URLSearchParams;
  handleSubmit?: CustomFormEventHandler;
  renderInputProps?: Partial<AutocompleteRenderInputParams>;
  locationType?: LocationType;
}

enum LoadingState {
  initial,
  loading,
  loaded,
}

export default function LocationSelect({
  queryParams,
  location,
  handleSubmit,
  setLocation,
  setLocations: setExternalLocations,
  updateURL,
  storeLocationInLocalStorage,
  required,
  renderInputProps,
  locationType = LocationType.IN_PERSON,
}: LocationSelectProps): ReactElement {
  const { oystehr } = useApiClients();
  const [locations, setLocations] = useState<LocationWithWalkinSchedule[]>([]);
  const [loadingState, setLoadingState] = useState(LoadingState.initial);
  const navigate = useNavigate();

  useEffect(() => {
    if (updateURL && localStorage.getItem('selectedLocation')) {
      queryParams?.set('locationID', JSON.parse(localStorage.getItem('selectedLocation') ?? '')?.id ?? '');
      navigate(`?${queryParams?.toString()}`);
    }
  }, [navigate, queryParams, updateURL]);

  useEffect(() => {
    async function getLocationsResults(oystehr: Oystehr): Promise<void> {
      if (!oystehr) {
        return;
      }

      setLoadingState(LoadingState.loading);

      try {
        const searchResults = await getAllFhirSearchPages<Location | Schedule>(
          {
            resourceType: 'Location',
            params: [{ name: '_revinclude', value: 'Schedule:actor:Location' }],
          },
          oystehr
        );
        const locationsResults = searchResults.filter((loc) => loc.resourceType === 'Location');
        const mappedLocations: LocationWithWalkinSchedule[] = locationsResults.map((locationTemp) => {
          const location = locationTemp as LocationWithWalkinSchedule;
          const schedule = searchResults.find((scheduleTemp) => {
            return (
              scheduleTemp.resourceType === 'Schedule' &&
              scheduleTemp.actor?.some((actor) => actor.reference === `Location/${location.id}`)
            );
          }) as Schedule;
          return { ...location, walkinSchedule: schedule };
        });
        setLocations(mappedLocations);
        setExternalLocations?.(mappedLocations);
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setLoadingState(LoadingState.loaded);
      }
    }

    if (oystehr && loadingState === LoadingState.initial) {
      void getLocationsResults(oystehr);
    }
  }, [oystehr, loadingState, setExternalLocations]);

  const getLocationLabel = (location: LocationWithWalkinSchedule): string => {
    if (!location.name) {
      console.log('Location name is undefined', location);
      return 'Unknown Location';
    }
    return location.address?.state ? `${location.address.state.toUpperCase()} - ${location.name}` : location.name;
  };

  const options = useMemo(() => {
    const allLocations = locations
      .filter(
        (location) =>
          (locationType === LocationType.IN_PERSON ? !isLocationVirtual(location) : true) &&
          (locationType === LocationType.VIRTUAL ? isLocationVirtual(location) : true)
      )
      .map((location) => {
        return {
          label: getLocationLabel(location),
          value: location.id,
        };
      });

    return sortLocationsByLabel(allLocations as { label: string; value: string }[]);
  }, [locationType, locations]);

  const handleLocationChange = (event: any, newValue: any): void => {
    const selectedLocation = newValue
      ? locations.find((locationTemp) => locationTemp.id === newValue.value)
      : undefined;
    console.log('selected location in handle location change', selectedLocation);
    setLocation(selectedLocation);

    if (storeLocationInLocalStorage) {
      if (newValue) {
        localStorage.setItem('selectedLocation', JSON.stringify(selectedLocation));
      } else {
        localStorage.removeItem('selectedLocation');
      }
    }

    if (handleSubmit) {
      handleSubmit(event, selectedLocation, 'location');
    }
  };

  return (
    <Autocomplete
      data-testid={dataTestIds.dashboard.locationSelect}
      disabled={renderInputProps?.disabled}
      size={renderInputProps?.size}
      value={
        location
          ? {
              label: getLocationLabel(location),
              value: location?.id,
            }
          : null
      }
      onChange={handleLocationChange}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={options}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.value}>
            {option.label}
          </li>
        );
      }}
      fullWidth
      renderInput={(params) => (
        <TextField placeholder="Search location" name="location" {...params} label="Location" required={required} />
      )}
    />
  );
}
