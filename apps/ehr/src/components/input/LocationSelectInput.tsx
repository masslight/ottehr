import { Location } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { isLocationVirtual } from 'utils';
import { AutocompleteInput } from './AutocompleteInput';
import { Option } from './Option';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

export const LocationSelectInput: React.FC<Props> = ({ name, label, required }) => {
  const { oystehr } = useApiClients();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[] | undefined>(undefined);
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
            params: [{ name: '_count', value: '30' }],
          })
        )
          .unbundle()
          .filter((location: Location) => !isLocationVirtual(location))
          .map((location: Location) => ({
            value: location.id ?? '',
            label: getLocationLabel(location),
          }));
        options.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
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
      valueToOption={(value: any) => {
        return {
          label: value.name,
          value: value.id,
        };
      }}
      optionToValue={(option: Option) => {
        return {
          name: option.label,
          id: option.value,
        };
      }}
    />
  );
};

function getLocationLabel(location: Location): string {
  if (!location.name) {
    return 'Unknown Location';
  }
  return location.address?.state ? `${location.address.state.toUpperCase()} - ${location.name}` : location.name;
}
