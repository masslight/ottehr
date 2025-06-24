import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isLocationVirtual } from 'utils';
import { Option } from '../../features/css-module/components/medication-administration/medicationTypes';
import { useApiClients } from '../../hooks/useAppClients';

export const useLocationsOptions = (): {
  location: {
    options: Option[];
    status: 'loading' | 'loaded';
  };
} => {
  const [locationsOptions, setLocationsOptions] = useState<Option[]>([]);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const { oystehr } = useApiClients();
  const { encounterId } = useParams();

  useEffect(() => {
    if (!oystehr) {
      return;
    }

    async function getLocationsResults(oystehr: Oystehr): Promise<void> {
      try {
        setIsLocationLoading(true);
        const locations = await oystehr.fhir.search<Location>({
          resourceType: 'Location',
          params: [{ name: '_count', value: '1000' }],
        });
        const locationsResults = Array.from(new Set(locations.entry))
          ?.filter((loc: any) => !isLocationVirtual(loc.resource))
          .map((loc: any) => ({
            value: loc.resource?.name as string,
            label: loc.resource?.name as string,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setLocationsOptions(locationsResults);
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setIsLocationLoading(false);
      }
    }

    void getLocationsResults(oystehr);
  }, [encounterId, oystehr]);

  return {
    location: {
      options: locationsOptions,
      status: isLocationLoading ? 'loading' : 'loaded',
    },
  };
};
