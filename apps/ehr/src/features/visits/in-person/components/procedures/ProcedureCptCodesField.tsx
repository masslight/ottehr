import { FC } from 'react';
import { CptCodeSearch } from 'src/components/input/CptCodeSearch';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatProcedureCptCode } from 'utils/lib/procedure-coding/format';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ListSentence } from './narrative/ListSentence';

interface ProcedureCptCodesFieldProps {
  codes: CPTCodeDTO[];
  onChange: (codes: CPTCodeDTO[]) => void;
  readOnly: boolean;
}

export const ProcedureCptCodesField: FC<ProcedureCptCodesFieldProps> = ({ codes, onChange, readOnly }) => (
  <ListSentence
    label="CPT codes"
    items={codes}
    itemText={formatProcedureCptCode}
    onRemove={(index) => onChange(codes.filter((_, itemIndex) => itemIndex !== index))}
    readOnly={readOnly}
    blankLabel="CPT code"
    title="CPT code"
    testIds={{ add: dataTestIds.documentProcedurePage.addCptCode, text: dataTestIds.documentProcedurePage.cptCode }}
  >
    {(close) => (
      <CptCodeSearch
        label="Search CPT codes"
        selected={codes}
        dataTestId={dataTestIds.documentProcedurePage.cptCodeInput}
        onPick={(code) => {
          onChange([...codes, code]);
          close();
        }}
      />
    )}
  </ListSentence>
);
