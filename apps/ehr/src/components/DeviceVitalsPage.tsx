import { ReactElement } from 'react';
import { DeviceVitalsTable } from './DeviceVitalsTable';

interface VitalsData {
  patientId: string;
  deviceId: string;
  deviceType: string;
  thresholds: [];
  onBack: () => void;
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

export const DeviceVitalsPage = ({ patientId, deviceId, deviceType, thresholds, onBack }: VitalsData): ReactElement => {
  // const location = useLocation();
  // const { deviceId } = useParams<{ deviceId: string | undefined }>();
  // const deviceType = location.state?.deviceType as string;
  // const thresholds = location.state?.thresholds || [];

  return (
    <div>
      <DeviceVitalsTable
        patientId={patientId}
        onBack={onBack}
        deviceId={deviceId}
        deviceType={deviceType}
        thresholds={thresholds}
        loading={!deviceId || !patientId}
      />
    </div>
  );
};
