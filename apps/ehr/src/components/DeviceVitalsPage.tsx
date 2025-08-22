import { ReactElement } from 'react';
import { useLocation } from 'react-router-dom';
import { DeviceVitalsTable } from './DeviceVitalsTable';

interface VitalsData {
  message: string;
  vitals: Array<{
    valueString?: string;
    valueInteger?: number;
    code: {
      text: string;
    };
  }>;
  total: number;
}

export const DeviceVitalsPage = (): ReactElement => {
  const location = useLocation();
  const vitalsData = location.state?.vitalsData as VitalsData | undefined;
  const deviceType = location.state?.deviceType as string;
  const thresholds = location.state?.thresholds || [];
  const deviceId = location.pathname.split('/').pop() || '';

  return (
    <div>
      <DeviceVitalsTable
        vitalsData={vitalsData}
        deviceId={deviceId}
        deviceType={deviceType}
        thresholds={thresholds}
        loading={!vitalsData}
      />
    </div>
  );
};
