import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { isLocationVirtual, MedicationApplianceRoutes, medicationApplianceRoutes } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore, useGetMedicationList } from '../../../telemed';
import { Option } from '../components/medication-administration/medicationTypes';

const getRoutesArray = (routes: MedicationApplianceRoutes): Option[] => {
  return Object.entries(routes).map(([_, value]) => ({
    value: value.code,
    label: value.display,
  })) as Option[];
};

export type OrderFieldsSelectsOptions = Record<
  'medicationId' | 'location' | 'route' | 'units' | 'associatedDx',
  { options: Option[]; status: 'loading' | 'loaded'; defaultOption?: Option }
>;

// fast fix to prevent multiple requests to get locations
const cacheLocations = {} as any;

export const useFieldsSelectsOptions = (): OrderFieldsSelectsOptions => {
  const { data: medicationList, isLoading: isMedicationLoading } = useGetMedicationList();
  const [locationsOptions, setLocationsOptions] = useState<Option[]>([]);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const { oystehr } = useApiClients();
  const { chartData, isChartDataLoading } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);
  const { encounterId } = useParams();

  const diagnosis = chartData?.diagnosis;

  const diagnosisSelectOptions: Option[] =
    diagnosis?.map((item) => ({
      value: item.resourceId || '',
      label: `${item.code} - ${item.display}`,
    })) || [];
  const primaryDiagnosis = diagnosis?.find((item) => item.isPrimary);
  const diagnosisDefaultOption = primaryDiagnosis && {
    value: primaryDiagnosis.resourceId || '',
    label: `${primaryDiagnosis.code} - ${primaryDiagnosis.display}`,
  };

  useEffect(() => {
    if (!oystehr) {
      return;
    }

    async function getLocationsResults(oystehr: Oystehr): Promise<void> {
      try {
        setIsLocationLoading(true);

        cacheLocations[encounterId || 'default'] =
          cacheLocations[encounterId || 'default'] ||
          oystehr.fhir.search<Location>({
            resourceType: 'Location',
            params: [{ name: '_count', value: '1000' }],
          });

        const locationsResults = (await cacheLocations[encounterId || 'default']).filter(
          (loc: Location) => !isLocationVirtual(loc)
        );

        setLocationsOptions(
          locationsResults.map((loc: Location) => ({
            value: loc.id as string,
            label: loc.name as string,
          }))
        );
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setIsLocationLoading(false);
      }
    }

    void getLocationsResults(oystehr);
  }, [encounterId, oystehr]);

  const medicationListOptions: Option[] = Object.entries(medicationList || {})
    .map(([id, value]) => ({
      value: id,
      label: value,
    }))
    .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  medicationListOptions.unshift({ value: '', label: 'Select Medication' });

  return {
    medicationId: {
      options: medicationListOptions,
      status: isMedicationLoading ? 'loading' : 'loaded',
    },
    location: {
      options: locationsOptions,
      status: isLocationLoading ? 'loading' : 'loaded',
    },
    route: {
      options: getRoutesArray(medicationApplianceRoutes)?.sort((a, b) =>
        a.label.toLowerCase().localeCompare(b.label.toLowerCase())
      ),
      status: 'loaded',
    },
    units: {
      options: [
        { value: 'mg', label: 'mg' },
        { value: 'ml', label: 'mL' },
        { value: 'g', label: 'g' },
        { value: 'cc', label: 'cc' },
      ],
      status: 'loaded',
    },
    associatedDx: {
      options: diagnosisSelectOptions,
      status: isChartDataLoading ? 'loading' : 'loaded',
      defaultOption: diagnosisDefaultOption,
    },
  };
};
