import { Autocomplete, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, Reference } from 'fhir/r4b';
import { useMemo, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { useMergedInsuranceQuickPicks } from 'src/hooks/useMergedQuickPicks';

export const InsuranceSearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onExtraData?: (data: Record<string, string>) => void;
}> = ({ value, onChange, onExtraData }) => {
  const { oystehrZambda } = useApiClients();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: payers, isFetching } = useQuery({
    queryKey: ['admin-insurance-quick-pick-payers'],
    queryFn: async (): Promise<Reference[]> => {
      if (!oystehrZambda) return [];
      const res = await oystehrZambda.zambda.execute({
        id: 'get-all-insurance-payers',
        answerSource: { zambdaId: 'get-all-insurance-payers', prependIdentifier: true },
      });
      const output = (res.output as Partial<QuestionnaireItemAnswerOption>[]) ?? [];
      return output
        .map((option) => option.valueReference)
        .filter((ref): ref is Reference => !!ref?.reference && !!ref?.display);
    },
    enabled: !!oystehrZambda,
    staleTime: 5 * 60 * 1000,
  });

  const { quickPicks: existingPicks, loading: existingLoading } = useMergedInsuranceQuickPicks();
  const existingReferences = useMemo(() => new Set(existingPicks.map((p) => p.organizationReference)), [existingPicks]);

  const options = useMemo(
    () => (existingLoading ? [] : (payers ?? []).filter((p) => !existingReferences.has(p.reference ?? ''))),
    [existingLoading, payers, existingReferences]
  );
  const selectedOption = value
    ? (options.find((opt) => opt.display === value) ?? ({ display: value } as Reference))
    : null;

  return (
    <Autocomplete
      value={selectedOption}
      inputValue={searchTerm || value}
      onInputChange={(_e, newInputValue, reason) => {
        if (reason === 'input') setSearchTerm(newInputValue);
      }}
      onChange={(_e, selected) => {
        if (selected?.display && selected.reference) {
          onChange(selected.display);
          // Display format is "<payerId> - <name>" when prependIdentifier=true.
          const payerId = selected.display.includes(' - ') ? selected.display.split(' - ')[0] : '';
          onExtraData?.({ payerId, organizationReference: selected.reference });
          setSearchTerm('');
        } else {
          onChange('');
          onExtraData?.({ payerId: '', organizationReference: '' });
        }
      }}
      getOptionLabel={(option) => option.display ?? ''}
      isOptionEqualToValue={(option, val) => option.reference === val.reference}
      options={options}
      loading={isFetching || existingLoading}
      fullWidth
      noOptionsText={isFetching || existingLoading ? 'Loading payers…' : 'No matching payers'}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Insurance"
          placeholder="Search insurance carriers..."
          required
          InputLabelProps={{ shrink: true }}
        />
      )}
    />
  );
};
