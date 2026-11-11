import React from 'react';
import { CptCodeSearch } from 'src/components/input/CptCodeSearch';
import { ListSentence } from 'src/features/visits/in-person/components/procedures/narrative/ListSentence';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

interface DmeBillingCodesSentenceProps {
  value: CPTCodeDTO[];
  onChange: (value: CPTCodeDTO[]) => void;
  readOnly: boolean;
  dataTestId?: string;
}

/** "CPT / HCPCS codes: L4361 Walking boot; … + another", the same pattern as the diagnosis sentence. */
export const DmeBillingCodesSentence: React.FC<DmeBillingCodesSentenceProps> = ({
  value,
  onChange,
  readOnly,
  dataTestId,
}) => (
  <ListSentence
    label="CPT / HCPCS codes"
    items={value}
    itemText={(code) => `${code.code} ${code.display}`}
    onRemove={(index) => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
    readOnly={readOnly}
    blankLabel={readOnly ? 'none' : 'add CPT / HCPCS code'}
    title="CPT / HCPCS code"
    testIds={{ sentence: dataTestId }}
  >
    {(close) => (
      <CptCodeSearch
        label="Search CPT / HCPCS codes"
        selected={value}
        onPick={(code) => {
          onChange([...value, code]);
          close();
        }}
      />
    )}
  </ListSentence>
);
