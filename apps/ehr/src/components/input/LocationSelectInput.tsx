import { Location } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { isLocationVirtual } from 'utils';
import { AutocompleteInput } from './AutocompleteInput';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

export const LocationSelectInput: React.FC<Props> = ({ name, label, required }) => {
  const { oystehr } = useApiClients();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<{ id: string; name: string }[] | undefined>(undefined);
  useEffect(() => {
    if (!oystehr) {
      return;
    }
    async function loadLocationsOptions(): Promise<void> {
      if (!oystehr) {
        return;
      }
      try {
        setIsLoading(true);
        const options = (
          await oystehr.fhir.search<Location>({
            resourceType: 'Location',
            params: [{ name: '_count', value: '1000' }],
          })
        )
          .unbundle()
          .filter((location: Location) => !isLocationVirtual(location))
          .map((location: Location) => ({
            id: location.id ?? '',
            name: getLocationLabel(location),
          }));
        options.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        setOptions(options);
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setIsLoading(false);
      }
    }
    void loadLocationsOptions();
  }, [oystehr]);
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={isLoading}
      required={required}
      getOptionLabel={(option) => option.name}
      getOptionKey={(option) => option.id}
      isOptionEqualToValue={(option, value) => option.id === value.id}
    />
  );
};

function getLocationLabel(location: Location): string {
  if (!location.name) {
    return 'Unknown Location';
  }
  return location.address?.state ? `${location.address.state.toUpperCase()} - ${location.name}` : location.name;
}
