import React, { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { SurgicalHistoryPatientColumn } from './SurgicalHistoryPatientColumn';
import { SurgicalHistoryProviderColumn } from './SurgicalHistoryProviderColumn';

export const SurgicalHistoryCard: FC = () => {
  const [isSurgicalHistoryCollapsed, setIsSurgicalHistoryCollapsed] = useState(false);

  return (
    <MedicalHistoryDoubleCard
      label="Surgical history"
      collapsed={isSurgicalHistoryCollapsed}
      onSwitch={() => setIsSurgicalHistoryCollapsed((state) => !state)}
      patientSide={<SurgicalHistoryPatientColumn />}
      providerSide={<SurgicalHistoryProviderColumn />}
    />
  );
};
