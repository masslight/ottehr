import { Close } from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import { FC, Fragment, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { DiagnosesField } from '../../../../shared/components/assessment-tab/DiagnosesField';
import { PopoverBlank, Sentence } from './InlineBlanks';

interface Props {
  diagnoses: readonly DiagnosisDTO[];
  visitDiagnoses: readonly DiagnosisDTO[];
  readOnly: boolean;
  onChange: (diagnoses: DiagnosisDTO[]) => void;
}

/** Visit quick picks offer each unselected code once and link its existing Condition ID. */
export const ProcedureDiagnosesSentence: FC<Props> = ({ diagnoses, visitDiagnoses, readOnly, onChange }) => {
  const diagnosisChoices = useMemo(() => {
    const seenCodes = new Set(diagnoses.map((diagnosis) => diagnosis.code));
    return visitDiagnoses.filter((diagnosis) => {
      if (seenCodes.has(diagnosis.code)) return false;
      seenCodes.add(diagnosis.code);
      return true;
    });
  }, [visitDiagnoses, diagnoses]);
  return (
    <Sentence>
      Diagnosis:{' '}
      {diagnoses.map((diagnosis, index) => (
        <Fragment key={diagnosis.resourceId ?? diagnosis.code}>
          {index > 0 && '; '}
          <Box component="span" data-testid={dataTestIds.documentProcedurePage.diagnosisItem}>
            <Box
              component="span"
              sx={{ color: 'primary.main', fontWeight: 500 }}
              data-testid={dataTestIds.documentProcedurePage.diagnosis}
            >
              {diagnosis.display} {diagnosis.code}
            </Box>
            {!readOnly && (
              <IconButton
                size="small"
                aria-label={`Remove ${diagnosis.code}`}
                data-testid={dataTestIds.documentProcedurePage.diagnosisDeleteButton}
                onClick={() => onChange(diagnoses.filter((item) => item.code !== diagnosis.code))}
                sx={{ p: '2px', ml: '2px' }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        </Fragment>
      ))}{' '}
      {(!readOnly || diagnoses.length === 0) && (
        <PopoverBlank
          label={diagnoses.length ? '+ another' : 'diagnosis'}
          title="Diagnosis"
          ghost={diagnoses.length > 0}
          need={diagnoses.length === 0}
          readOnly={readOnly}
          dataTestId={dataTestIds.documentProcedurePage.addDiagnosis}
        >
          {(close) => (
            <Box sx={{ width: 360, maxWidth: '100%', pt: 0.5 }}>
              <DiagnosesField
                label="Dx"
                onChange={(value: IcdSearchResponse['codes'][number]) => {
                  if (!diagnoses.some((diagnosis) => diagnosis.code === value.code)) {
                    const existing = visitDiagnoses.find((diagnosis) => diagnosis.code === value.code);
                    onChange([...diagnoses, { ...(existing ?? value), isPrimary: false }]);
                  }
                  close();
                }}
                quickPickOptions={diagnosisChoices}
                disableForPrimary={false}
                disabled={readOnly}
              />
            </Box>
          )}
        </PopoverBlank>
      )}
    </Sentence>
  );
};
