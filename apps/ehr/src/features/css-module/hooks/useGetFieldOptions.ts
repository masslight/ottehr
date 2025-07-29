import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import { isLocationVirtual, MedicationApplianceRoutes, medicationApplianceRoutes, RoleType } from 'utils';
import { getEmployees } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
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
  'medicationId' | 'location' | 'route' | 'units' | 'associatedDx' | 'providerId',
  { options: Option[]; status: 'loading' | 'loaded'; defaultOption?: Option }
>;

// fast fix to prevent multiple requests to get locations
const cacheLocations = {} as any;

export const useFieldsSelectsOptions = (): OrderFieldsSelectsOptions => {
  const { data: medicationList, isLoading: isMedicationLoading } = useGetMedicationList();
  const [locationsOptions, setLocationsOptions] = useState<Option[]>([]);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [providersOptions, setProvidersOptions] = useState<Option[]>([]);
  const [isProvidersLoading, setIsProvidersLoading] = useState(true);
  const { oystehrZambda } = useApiClients();
  const currentUser = useEvolveUser();

  const { chartData, isChartDataLoading, encounter } = getSelectors(useAppointmentStore, [
    'chartData',
    'isChartDataLoading',
    'encounter',
  ]);

  const encounterId = encounter?.id;

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
    if (!oystehrZambda) {
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

        const locationsBundle = await cacheLocations[encounterId || 'default'];
        const locationsResults = locationsBundle.unbundle().filter((loc: Location) => !isLocationVirtual(loc));

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

    void getLocationsResults(oystehrZambda);
  }, [encounterId, oystehrZambda]);

  useEffect(() => {
    if (!oystehrZambda || !encounterId) {
      return;
    }

    async function getProvidersResults(): Promise<void> {
      try {
        if (!oystehrZambda) {
          return;
        }

        setIsProvidersLoading(true);
        const data = await getEmployees(oystehrZambda);

        if (data.employees) {
          const activeProviders = data.employees.filter(
            (employee: any) => employee.status === 'Active' && employee.isProvider
          );

          const providerOptions = activeProviders.map((employee: any) => ({
            value: employee.profile.split('/')[1],
            label: `${employee.firstName} ${employee.lastName}`.trim() || employee.name,
          }));

          providerOptions.sort((a: Option, b: Option) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
          setProvidersOptions(providerOptions);
        }
      } catch (e) {
        console.error('error loading provided by field', e);
      } finally {
        setIsProvidersLoading(false);
      }
    }

    void getProvidersResults();
  }, [oystehrZambda, encounterId]);

  const medicationListOptions: Option[] = Object.entries(medicationList || {})
    .map(([id, value]) => ({
      value: id,
      label: value,
    }))
    .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  medicationListOptions.unshift({ value: '', label: 'Select Medication' });

  // Determine default provider (current user for Provider role)
  const currentUserProviderId = currentUser?.profile?.replace('Practitioner/', '');
  const currentUserHasProviderRole = currentUser?.hasRole?.([RoleType.Provider]);
  const defaultProvider =
    currentUserHasProviderRole && currentUserProviderId
      ? providersOptions.find((option) => option.value === currentUserProviderId)
      : undefined;

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
        { value: 'unit', label: 'unit' },
        { value: 'application', label: 'application' },
      ],
      status: 'loaded',
    },
    associatedDx: {
      options: diagnosisSelectOptions,
      status: isChartDataLoading ? 'loading' : 'loaded',
      defaultOption: diagnosisDefaultOption,
    },
    providerId: {
      options: providersOptions,
      status: isProvidersLoading ? 'loading' : 'loaded',
      defaultOption: defaultProvider,
    },
  };
};
