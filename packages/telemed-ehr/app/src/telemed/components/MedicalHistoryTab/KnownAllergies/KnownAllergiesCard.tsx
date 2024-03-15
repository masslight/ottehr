import React, { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { KnownAllergiesPatientColumn } from './KnownAllergiesPatientColumn';
import { KnownAllergiesProviderColumn } from './KnownAllergiesProviderColumn';

export const KnownAllergiesCard: FC = () => {
  const [isAllergiesCollapsed, setIsAllergiesCollapsed] = useState(false);

  return (
    <MedicalHistoryDoubleCard
      label="Known allergies"
      collapsed={isAllergiesCollapsed}
      onSwitch={() => setIsAllergiesCollapsed((state) => !state)}
      patientSide={<KnownAllergiesPatientColumn />}
      providerSide={<KnownAllergiesProviderColumn />}
    />
  );
};
