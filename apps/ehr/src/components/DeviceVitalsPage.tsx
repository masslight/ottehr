import { ReactElement } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { DeviceVitalsTable } from './DeviceVitalsTable';

interface VitalsData {
  message: string;
  observations: Array<{
    id: string;
    code: string;
    status: string;
    effectiveDateTime?: string;
    components: Array<{
      code: { text: string };
      valueString?: string;
      valueInteger?: number;
    }>;
  }>;
  total: number;
}

export const DeviceVitalsPage = (): ReactElement => {
  const location = useLocation();
  const { deviceId } = useParams<{ deviceId: string | undefined }>();
  const vitalsData = location.state?.vitalsData as VitalsData | undefined;
  const deviceType = location.state?.deviceType as string;
  const thresholds = location.state?.thresholds || [];

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
