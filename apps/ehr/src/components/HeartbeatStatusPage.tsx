import { ReactElement } from 'react';
import { HeartbeatStatusTable } from './HeartbeatStatusTable';

export const HeartbeatStatusPage = (): ReactElement => {
  const dummyData = {
    deviceId: 'BGM-123456789',
    createdAt: 1684740186,
    isTest: false,
    modelNumber: 'BGM-GEN1-2023',
    status: {
      data_type: 'bgm_gen1_heartbeat',
      imei: '864475040090333',
      imsi: '460081948308296',
      iccid: '89860499102170308296f',
      sig: 16,
      apn: 'hologram',
      bat: 60,
      tz: 8,
      kernel_ver: 'BG95M3LAR02A03_BETA0614',
      app_ver: '0.1.0',
      mcuv: 'SW2071238011A001',
      uptime: 1684740186,
    },
  };

  const loading = false;
  const error = null;

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading device heartbeat</div>;

  return (
    <div>
      <HeartbeatStatusTable
        status={dummyData.status}
        deviceId={dummyData.deviceId}
        createdAt={dummyData.createdAt}
        isTest={dummyData.isTest}
        modelNumber={dummyData.modelNumber}
      />
    </div>
  );
};
