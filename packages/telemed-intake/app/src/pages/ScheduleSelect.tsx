import { Box, Skeleton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { CustomContainer } from '../features/common';
import { useZapEHRAPIClient } from '../utils';
import { useGetLocations, useGetProviders } from '../features/homepage';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInputType, PageForm } from 'ottehr-components';
import { useState } from 'react';

const ScheduleSelect = (): JSX.Element => {
  const methods = useForm();
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [scheduleType, setScheduleType] = useState<'provider' | 'location' | ''>('');

  const { data: providersData, isFetching: isFetchingProviders } = useGetProviders(apiClient, Boolean(apiClient));
  const { data: locationsData, isFetching: isFetchingLocations } = useGetLocations(apiClient, Boolean(apiClient));

  console.log('providersData', providersData);
  console.log('locationsData', locationsData);

  const handleRequestVisit = (data: any): void => {
    console.log('Form data:', data);
    navigate(
      `${IntakeFlowPageRoute.Welcome.path
        .replace(':schedule-type', data['Schedule Type'])
        .replace(':slug', data['Provider'])
        .replace(':visit-service', data['Visit Service'])
        .replace(':visit-type', data['Visit Type'])}`,
    );
  };

  const formElements: FormInputType[] = [
    {
      type: 'Select',
      name: 'scheduleType',
      label: 'Schedule Type',
      required: true,
      selectOptions: [
        { label: 'Provider', value: 'provider' },
        { label: 'Location', value: 'location' },
      ],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setScheduleType(event.target.value as 'provider' | 'location');
      },
    },
    {
      type: 'Select',
      name: 'Provider',
      label: 'Provider',
      required: true,
      selectOptions: providersData
        ? providersData.map((provider) => ({
            label:
              provider.name?.[0]?.text ||
              `${provider.name?.[0]?.given?.[0] || ''} ${provider.name?.[0]?.family || ''}`.trim(),
            value: provider.id || '',
          }))
        : [],
      hidden: scheduleType !== 'provider',
    },
    {
      type: 'Select',
      name: 'Location',
      label: 'Location',
      required: true,
      selectOptions: locationsData
        ? locationsData.map((location) => ({
            label: location.name || '',
            value: location.id || '',
          }))
        : [],
      hidden: scheduleType !== 'location',
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
        {isFetchingProviders || isFetchingLocations ? (
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
                loading: isFetchingProviders || isFetchingLocations,
                submitDisabled: isFetchingProviders || isFetchingLocations,
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
