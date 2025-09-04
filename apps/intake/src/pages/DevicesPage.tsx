import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import { Box, Skeleton, Typography } from '@mui/material';
import moment from 'moment';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import ottehrApi from '../api/ottehrApi';
import HomepageOption from '../components/HomepageOption';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors } from '../IntakeThemeProvider';
import { CustomContainer } from '../telemed/features/common';

interface Device {
  id: string;
  name: string;
}

const DevicesPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [assignedDevices, setAssignedDevices] = useState<Device[]>([]);
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });

  const {
    isLoading: devicesLoading,
    isFetching: devicesFetching,
    isRefetching: devicesRefetching,
    error: devicesError,
  } = useQuery(
    ['get-devices', { zambdaClient: tokenfulZambdaClient }],
    () => ottehrApi.getPatientDevices(tokenfulZambdaClient!),
    {
      onSuccess: (response) => {
        if (response?.devices) {
          const devices = response?.devices.map((device: any) => ({
            id: device.id,
            name: device?.identifier?.[0]?.value || '-',
            manufacturer: device.manufacturer || '-',
            lastUpdated: moment(device.meta.lastUpdated).format('MM/DD/YYYY'),
            versionId: device.meta.versionId,
            distinctIdentifier: device?.distinctIdentifier,
            serialNumber: device?.serialNumber,
            modelNumber: device?.modelNumber,
            hardwareVersion: device?.version?.find((x: any) => x?.type?.text == 'hardwareVersion')?.value || '-',
            modemVersion: device?.version?.find((x: any) => x?.type?.text == 'modemVersion')?.value || '-',
            firmwareVersion: device?.version?.find((x: any) => x?.type?.text == 'firmwareVersion')?.value || '-',
          }));
          setAssignedDevices(devices);
        }
      },
      onError: (error) => {
        console.log('get devices error:', error);
      },
      enabled: Boolean(tokenfulZambdaClient),
    }
  );

  const handleDeviceClick = (device: any): void => {
    console.log('Device clicked:', device);
    navigate('/devices', { state: { device } });
  };

  if (devicesLoading || devicesFetching || devicesRefetching) {
    return (
      <CustomContainer title="My Devices" description="" isFirstPage={true}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={115}
              sx={{
                borderRadius: 2,
                backgroundColor: otherColors.coachingVisit,
              }}
            />
          ))}
        </Box>
      </CustomContainer>
    );
  }

  if (devicesError) {
    return (
      <CustomContainer title="My Devices" description="" isFirstPage={true}>
        <Typography color="error">Error loading devices. Please try again.</Typography>
      </CustomContainer>
    );
  }

  if (assignedDevices.length === 0) {
    return (
      <CustomContainer title="My Devices" description="" isFirstPage={true}>
        <Typography color="error">No devices assigned.</Typography>
      </CustomContainer>
    );
  }

  return (
    <CustomContainer title="My Devices" description="" isFirstPage={true}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {assignedDevices.map((device: Device) => (
          <HomepageOption
            key={device.id}
            title={device.name}
            icon={<MonitorHeartOutlinedIcon />}
            handleClick={() => handleDeviceClick(device)}
          />
        ))}
      </Box>
    </CustomContainer>
  );
};

export default DevicesPage;
