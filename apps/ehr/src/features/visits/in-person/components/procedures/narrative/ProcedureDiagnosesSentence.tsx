import { Box } from '@mui/material';
import { FC, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { DiagnosesField } from '../../../../shared/components/assessment-tab/DiagnosesField';
import { ListSentence } from './ListSentence';

interface Props {
  diagnoses: readonly DiagnosisDTO[];
  visitDiagnoses: readonly DiagnosisDTO[];
  readOnly: boolean;
  onChange: (diagnoses: DiagnosisDTO[]) => void;
  /** Whether an empty list shows as a required blank. */
  need?: boolean;
}

/** Visit quick picks offer each unselected code once. */
export const ProcedureDiagnosesSentence: FC<Props> = ({
  diagnoses,
  visitDiagnoses,
  readOnly,
  onChange,
  need = true,
}) => {
  const diagnosisChoices = useMemo(() => {
    const seenCodes = new Set(diagnoses.map((diagnosis) => diagnosis.code));
    return visitDiagnoses.filter((diagnosis) => {
      if (seenCodes.has(diagnosis.code)) return false;
      seenCodes.add(diagnosis.code);
      return true;
    });
  }, [visitDiagnoses, diagnoses]);
  return (
    <ListSentence
      label="Diagnosis"
      items={diagnoses}
      itemText={(diagnosis) => `${diagnosis.display} ${diagnosis.code}`}
      onRemove={(index) => onChange(diagnoses.filter((_, itemIndex) => itemIndex !== index))}
      readOnly={readOnly}
      blankLabel="diagnosis"
      title="Diagnosis"
      need={need}
      testIds={{
        add: dataTestIds.documentProcedurePage.addDiagnosis,
        item: dataTestIds.documentProcedurePage.diagnosisItem,
        text: dataTestIds.documentProcedurePage.diagnosis,
        remove: dataTestIds.documentProcedurePage.diagnosisDeleteButton,
      }}
    >
      {(close) => (
        <Box sx={{ width: 360, maxWidth: '100%', pt: 0.5 }}>
          <DiagnosesField
            label="Dx"
            onChange={(value: IcdSearchResponse['codes'][number]) => {
              if (!diagnoses.some((diagnosis) => diagnosis.code === value.code)) {
                onChange([...diagnoses, { ...value, isPrimary: false }]);
              }
              close();
            }}
            quickPickOptions={diagnosisChoices}
            disableForPrimary={false}
            disabled={readOnly}
          />
        </Box>
      )}
    </ListSentence>
  );
};
