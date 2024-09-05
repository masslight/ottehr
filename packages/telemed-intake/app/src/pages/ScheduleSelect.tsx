import { Box, Skeleton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { CustomContainer } from '../features/common';
import { useZapEHRAPIClient } from '../utils';
import { useGetGroups, useGetLocations, useGetProviders } from '../features/homepage';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInputType, PageForm } from 'ottehr-components';
import { useState } from 'react';
import { HealthcareService, HumanName, Location, Practitioner } from 'fhir/r4';

const ScheduleSelect = (): JSX.Element => {
  const methods = useForm();
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [scheduleType, setScheduleType] = useState<'Provider' | 'Location' | 'Group' | ''>('');
  const { data: providersData, isFetching: isFetchingProviders } = useGetProviders(apiClient, Boolean(apiClient));
  const { data: locationsData, isFetching: isFetchingLocations } = useGetLocations(apiClient, Boolean(apiClient));
  const { data: groupsData, isFetching: isFetchingGroups } = useGetGroups(apiClient, Boolean(apiClient));

  const convertFhirNameToDisplayName = (name: HumanName[]): string => {
    return `${name?.[0]?.given?.[0]} ${name?.[0]?.family}`;
  };

  const filterResourcesWithSlug = (
    resources: Location[] | Practitioner[] | HealthcareService[],
  ): (Location | Practitioner | HealthcareService)[] => {
    return resources.filter((resource) => {
      return resource.identifier?.[0]?.value;
    });
  };

  const handleRequestVisit = (data: any): void => {
    navigate(
      `${IntakeFlowPageRoute.Welcome.path
        .replace(':schedule-type', data['Schedule Type'].toLowerCase())
        .replace(':slug', data[data['Schedule Type']])
        .replace(':visit-service', data['Visit Service'])
        .replace(':visit-type', data['Visit Type'])}`,
    );
  };

  const formElements: FormInputType[] = [
    {
      type: 'Select',
      name: 'Schedule Type',
      label: 'Schedule Type',
      required: true,
      selectOptions: [
        { label: 'Provider', value: 'Provider' },
        { label: 'Location', value: 'Location' },
        { label: 'Group', value: 'Group' },
      ],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setScheduleType(event.target.value as 'Provider' | 'Location' | 'Group');
      },
    },
    {
      type: 'Select',
      name: 'Provider',
      label: 'Provider',
      required: scheduleType === 'Provider',
      selectOptions: providersData
        ? filterResourcesWithSlug(providersData).map((provider) => ({
            label: convertFhirNameToDisplayName(provider.name as HumanName[]),
            value: provider.identifier?.[0]?.value || '',
          }))
        : [],
      hidden: scheduleType !== 'Provider',
    },
    {
      type: 'Select',
      name: 'Location',
      label: 'Location',
      required: scheduleType === 'Location',
      selectOptions: locationsData
        ? filterResourcesWithSlug(locationsData).map((location) => ({
            label: location.name as string,
            value: location.identifier?.[0]?.value || '',
          }))
        : [],
      hidden: scheduleType !== 'Location',
    },
    {
      type: 'Select',
      name: 'Group',
      label: 'Group',
      required: scheduleType === 'Group',
      selectOptions: groupsData
        ? filterResourcesWithSlug(groupsData).map((group) => ({
            label: group.name as string,
            value: group.identifier?.[0]?.value || '',
          }))
        : [],
      hidden: scheduleType !== 'Group',
    },
    {
      type: 'Select',
      name: 'Visit Service',
      label: 'Visit Service',
      required: true,
      selectOptions: [
        {
          label: 'Telemedicine',
          value: 'telemedicine',
        },
        {
          label: 'In-Person',
          value: 'in-person',
        },
      ],
    },
    {
      type: 'Select',
      name: 'Visit Type',
      label: 'Visit Type',
      required: true,
      selectOptions: [
        {
          label: 'Prebook',
          value: 'prebook',
        },
        {
          label: 'Now',
          value: 'now',
        },
      ],
    },
  ];

  return (
    <FormProvider {...methods}>
      <CustomContainer
        title={t('selectSchedule.title')}
        description={t('selectSchedule.description')}
        bgVariant={IntakeFlowPageRoute.PatientPortal.path}
        isFirstPage={true}
      >
        {isFetchingProviders || isFetchingLocations || isFetchingGroups ? (
          <Skeleton
            sx={{
              borderRadius: 2,
              backgroundColor: otherColors.coachingVisit,
              p: 10,
              mt: -4,
            }}
          />
        ) : (
          <Box display="flex" flexDirection="column" gap={2}>
            <PageForm
              formElements={formElements}
              controlButtons={{
                loading: isFetchingProviders || isFetchingLocations || isFetchingGroups,
                submitDisabled: isFetchingProviders || isFetchingLocations || isFetchingGroups,
              }}
              onSubmit={handleRequestVisit}
            />
          </Box>
        )}
      </CustomContainer>
    </FormProvider>
  );
};

export default ScheduleSelect;
