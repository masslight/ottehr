import React, { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { MedicalConditionsPatientColumn } from './MedicalConditionsPatientColumn';
import { MedicalConditionsProviderColumn } from './MedicalConditionsProviderColumn';

export const MedicalConditionsCard: FC = () => {
  const [isConditionsCollapsed, setIsConditionsCollapsed] = useState(false);

  return (
    <MedicalHistoryDoubleCard
      label="Medical conditions"
      collapsed={isConditionsCollapsed}
      onSwitch={() => setIsConditionsCollapsed((state) => !state)}
      patientSide={<MedicalConditionsPatientColumn />}
      providerSide={<MedicalConditionsProviderColumn />}
    />
  );
};
