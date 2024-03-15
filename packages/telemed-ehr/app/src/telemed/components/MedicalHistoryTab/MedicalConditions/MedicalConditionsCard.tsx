import React, { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { MedicalConditionsProviderColumn } from './MedicalConditionsProviderColumn';
import { MedicalConditionsPatientColumn } from './MedicalConditionsPatientColumn';

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
