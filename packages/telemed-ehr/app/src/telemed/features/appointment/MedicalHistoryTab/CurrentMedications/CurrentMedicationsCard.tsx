import React, { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { CurrentMedicationsPatientColumn } from './CurrentMedicationsPatientColumn';
import { CurrentMedicationsProviderColumn } from './CurrentMedicationsProviderColumn';

export const CurrentMedicationsCard: FC = () => {
  const [isMedicationsCollapsed, setIsMedicationsCollapsed] = useState(false);

  return (
    <MedicalHistoryDoubleCard
      label="Current medications"
      collapsed={isMedicationsCollapsed}
      onSwitch={() => setIsMedicationsCollapsed((state) => !state)}
      patientSide={<CurrentMedicationsPatientColumn />}
      providerSide={<CurrentMedicationsProviderColumn />}
    />
  );
};
