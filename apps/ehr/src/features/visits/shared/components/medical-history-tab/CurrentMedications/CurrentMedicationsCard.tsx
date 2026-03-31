import { FC, useState } from 'react';
import { useMedicationHistory } from 'src/features/visits/in-person/hooks/useMedicationHistory';
import { useChartDataArrayValue } from '../../../hooks/useChartDataArrayValue';
import { MedicalHistoryDoubleCard } from '../MedicalHistoryDoubleCard';
import { CurrentMedicationsPatientColumn } from './CurrentMedicationsPatientColumn';
import { CurrentMedicationsProviderColumn } from './CurrentMedicationsProviderColumn';

export const CurrentMedicationsCard: FC = () => {
  const [isMedicationsCollapsed, setIsMedicationsCollapsed] = useState(false);

  const { refetchHistory } = useMedicationHistory();

  const {
    isLoading,
    onSubmit,
    onRemove,
    values: medications,
  } = useChartDataArrayValue(
    'medications',
    undefined,
    {
      _sort: '-_lastUpdated',
      _include: 'MedicationStatement:source',
      status: { type: 'token', value: 'active' },
    },
    refetchHistory
  );

  const medicationData = { medications, isLoading, onSubmit, onRemove, refetchHistory };

  return (
    <MedicalHistoryDoubleCard
      label="Current medications"
      collapsed={isMedicationsCollapsed}
      onSwitch={() => setIsMedicationsCollapsed((state) => !state)}
      patientSide={<CurrentMedicationsPatientColumn />}
      providerSide={<CurrentMedicationsProviderColumn medicationData={medicationData} />}
    />
  );
};
