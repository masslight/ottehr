import { ReactElement } from 'react';
import { DeviceVitalsTable } from './DeviceVitalsTable';

interface VitalsData {
  patientId: string;
  deviceId: string;
  name: string;
  deviceType: string;
  thresholds: [];
  onBack: () => void;
}

export const DeviceVitalsPage = ({
  patientId,
  deviceId,
  name,
  deviceType,
  thresholds,
  onBack,
}: VitalsData): ReactElement => {
  console.log('Device Id from DeviceVitalsPage:', deviceId);
  return (
    <div>
      <DeviceVitalsTable
        patientId={patientId}
        onBack={onBack}
        deviceId={deviceId}
        name={name}
        deviceType={deviceType}
        thresholds={thresholds}
        loading={!deviceId || !patientId}
        isModal={false}
      />
    </div>
  );
};
