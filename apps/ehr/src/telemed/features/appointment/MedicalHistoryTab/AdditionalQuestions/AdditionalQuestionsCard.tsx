import { FC, useState } from 'react';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { AdditionalQuestionsPatientColumn } from './AdditionalQuestionsPatientColumn';
import { AdditionalQuestionsProviderColumn } from './AdditionalQuestionsProviderColumn';

export const AdditionalQuestionsCard: FC = () => {
  const [isAdditionalQuestionsCollapsed, setIsAdditionalQuestionsCollapsed] = useState(false);

  return (
    <MedicalHistoryDoubleCard
      label="Additional questions"
      collapsed={isAdditionalQuestionsCollapsed}
      onSwitch={() => setIsAdditionalQuestionsCollapsed((state) => !state)}
      patientSide={<AdditionalQuestionsPatientColumn />}
      providerSide={<AdditionalQuestionsProviderColumn />}
    />
  );
};
