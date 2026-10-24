import { Close } from '@mui/icons-material';
import { Autocomplete, Box, FormHelperText, IconButton, TextField } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { SentencePicks, SuggestedSentences } from 'src/components/SuggestedSentences';
import { useIcd10SearchInput } from 'src/features/admin/patient-education/useIcd10SearchInput';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import {
  fillPrescriptionSuggestion,
  PrescriptionSuggestion,
  prescriptionSuggestions,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import { MedicationSearchResult } from 'utils/lib/types/api/erx-search.types';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { useSearchMedications } from '../../../shared/hooks/useErxSearch';
import { BlankButton, PopoverBlank, SelectBlank, Sentence, TextBlank } from '../procedures/narrative/InlineBlanks';
import { PrescriptionLine, prescriptionQuickPickLabel } from './prescriptionLines';

/** Units that read the same for any amount ("20 each", not "20 eachs"). */
const UNCOUNTED_UNITS: readonly QuantityUnit[] = ['Each', 'Gum', 'Unspecified'];

/** "Capsule" → "Capsules" unless the quantity is exactly 1. Display only: the order sends the NCPDP term as is. */
const unitLabel = (unit: QuantityUnit, quantity: string): string =>
  Number(quantity) === 1 || UNCOUNTED_UNITS.includes(unit)
    ? unit
    : /(s|x|ch|sh)$/.test(unit)
    ? `${unit}es`
    : `${unit}s`;

const SUBSTITUTION_OPTIONS = [
  { value: 'allowed', label: 'allowed' },
  { value: 'not allowed', label: 'not allowed (dispense as written)' },
];

const MedicationSearch: FC<{ onPick: (medication: MedicationSearchResult) => void }> = ({ onPick }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { debounce } = useDebounce(300);
  const { data: medications = [], isFetching } = useSearchMedications(debouncedQuery);
  return (
    <Box sx={{ width: 360, pt: 0.5 }}>
      <Autocomplete<MedicationSearchResult>
        options={medications}
        loading={isFetching}
        filterOptions={(options) => options}
        getOptionLabel={(option) => `${option.description} (${option.ndc})`}
        inputValue={query}
        onInputChange={(_event, value) => {
          setQuery(value);
          debounce(() => setDebouncedQuery(value));
        }}
        value={null}
        onChange={(_event, option) => option && onPick(option)}
        noOptionsText={
          query.trim().length < 2 ? 'Type to search medications' : 'Nothing found for this search criteria'
        }
        renderInput={(params) => <TextField {...params} size="small" label="Medication" />}
      />
    </Box>
  );
};

interface DiagnosisOption {
  code: string;
  display: string;
  group: 'Visit diagnoses' | 'Search results';
}

/** The visit's diagnoses first (filtered by what's typed), then ICD-10 search results not already among them. */
const DiagnosisSearch: FC<{
  visitDiagnoses: IcdSearchResponse['codes'];
  onPick: (diagnosis: { code: string; display: string }) => void;
}> = ({ visitDiagnoses, onPick }) => {
  const { inputValue: search, setInputValue: setSearch, options: searchResults, isFetching } = useIcd10SearchInput();
  const query = search.trim().toLowerCase();
  const options: DiagnosisOption[] = [
    ...visitDiagnoses
      .filter(
        (diagnosis, i) =>
          visitDiagnoses.findIndex((other) => other.code === diagnosis.code) === i &&
          `${diagnosis.code} ${diagnosis.display}`.toLowerCase().includes(query)
      )
      .map((diagnosis) => ({ code: diagnosis.code, display: diagnosis.display, group: 'Visit diagnoses' as const })),
    ...(query
      ? searchResults
          .filter((result) => !visitDiagnoses.some((diagnosis) => diagnosis.code === result.code))
          .map((result) => ({ code: result.code, display: result.display, group: 'Search results' as const }))
      : []),
  ];
  return (
    <Box sx={{ width: 360, pt: 0.5 }}>
      <Autocomplete<DiagnosisOption>
        options={options}
        loading={isFetching}
        filterOptions={(items) => items}
        groupBy={(option) => option.group}
        getOptionLabel={(option) => `${option.code} - ${option.display}`}
        inputValue={search}
        onInputChange={(_event, value, reason) => {
          if (reason === 'input' || reason === 'clear') setSearch(reason === 'input' ? value : '');
        }}
        value={null}
        onChange={(_event, option) => option && onPick({ code: option.code, display: option.display })}
        openOnFocus
        noOptionsText={search ? 'No diagnoses found' : 'Start typing to search for a diagnosis'}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            label="Diagnosis"
            placeholder="Select a visit diagnosis or type to search"
          />
        )}
      />
    </Box>
  );
};

interface PrescriptionSentencesProps {
  line: PrescriptionLine;
  index: number;
  onChange: (next: PrescriptionLine) => void;
  /** Absent for the only line: there is always one prescription to fill. */
  onRemove?: () => void;
  quickPicks: PrescriptionQuickPickData[];
  onQuickPick: (quickPick: PrescriptionQuickPickData) => void;
  /** Admins save the line as a quick pick; absent for everyone else. */
  onSaveQuickPick?: () => void;
  visitDiagnoses: IcdSearchResponse['codes'];
  /** Shown once a send has been tried. */
  errors: string[];
  readOnly: boolean;
}

/** One prescription as sentences: what, for what, how much, how to take it, and whether it may be substituted. */
export const PrescriptionSentences: FC<PrescriptionSentencesProps> = ({
  line,
  index,
  onChange,
  onRemove,
  quickPicks,
  onQuickPick,
  onSaveQuickPick,
  visitDiagnoses,
  errors,
  readOnly,
}) => {
  const update = (patch: Partial<PrescriptionLine>): void => onChange({ ...line, ...patch });
  const description = line.medication?.description;
  // A new rows array resets the picks inside SuggestedSentences, so it changes only with the medication.
  const suggestions = useMemo(() => (description ? prescriptionSuggestions(description) : []), [description]);
  const matches = (suggestion: PrescriptionSuggestion, picks: SentencePicks): boolean => {
    const filled = fillPrescriptionSuggestion(suggestion, picks);
    return (
      line.quantityValue.trim() === filled.quantityValue &&
      line.quantityUnit === filled.quantityUnit &&
      line.daysSupply.trim() === filled.daysSupply &&
      line.numberOfRefills.trim() === filled.numberOfRefills &&
      line.patientInstructions.trim() === filled.patientInstructions
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {!readOnly && (
        <Sentence>
          <SelectBlank
            label="+ quick pick"
            title="Quick pick"
            options={quickPicks.map((quickPick, i) => ({
              value: quickPick.id ?? String(i),
              label: prescriptionQuickPickLabel(quickPick),
            }))}
            value={undefined}
            onChange={(value) => {
              const quickPick = quickPicks.find((item, i) => (item.id ?? String(i)) === value);
              if (quickPick) onQuickPick(quickPick);
            }}
            readOnly={readOnly}
            emptyText={quickPicks.length ? 'No matches' : 'No quick picks yet'}
          />{' '}
          {onSaveQuickPick && line.medication && (
            <BlankButton label="+ save as quick pick" ghost readOnly={readOnly} onClick={onSaveQuickPick} />
          )}
        </Sentence>
      )}

      <Sentence onRemove={onRemove} removeLabel={`Remove prescription ${index + 1}`}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          Prescription {index + 1}:
        </Box>{' '}
        <PopoverBlank label="medication" title="Medication" value={description} need readOnly={readOnly}>
          {(close) => (
            <MedicationSearch
              onPick={(medication) => {
                // Directions written for another drug don't carry over.
                if (medication.ndc !== line.medication?.ndc) update({ medication, patientInstructions: '' });
                close();
              }}
            />
          )}
        </PopoverBlank>{' '}
        for {/* A chosen diagnosis stays a blank: clicking it searches again to swap it. */}
        <PopoverBlank
          label={line.diagnosis ? 'diagnosis' : 'add diagnosis'}
          title="Diagnosis"
          value={line.diagnosis ? `${line.diagnosis.display} ${line.diagnosis.code}` : undefined}
          readOnly={readOnly}
        >
          {(close) => (
            <DiagnosisSearch
              visitDiagnoses={visitDiagnoses}
              onPick={(diagnosis) => {
                update({ diagnosis });
                close();
              }}
            />
          )}
        </PopoverBlank>
        {line.diagnosis && !readOnly && (
          <IconButton
            size="small"
            aria-label={`Remove ${line.diagnosis.code}`}
            onClick={() => update({ diagnosis: null })}
            sx={{ p: '2px', ml: '2px' }}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        )}
        .
      </Sentence>

      {!readOnly && (
        <SuggestedSentences
          title="Suggested prescriptions"
          caption={
            !line.medication
              ? 'pick a medication to see suggestions'
              : suggestions.length === 0
              ? 'none for this dose form'
              : undefined
          }
          rows={suggestions}
          isAdded={matches}
          onAdd={(suggestion, picks) => update(fillPrescriptionSuggestion(suggestion, picks))}
          addLabel="Use this prescription"
          addedLabel="In use"
        />
      )}

      <Sentence>
        Dispense{' '}
        <TextBlank
          label="quantity"
          kind="number"
          value={line.quantityValue}
          onChange={(quantityValue) => update({ quantityValue })}
          readOnly={readOnly}
          need
          min={0}
          step={0.001}
        />{' '}
        <SelectBlank
          label="unit"
          title="Unit"
          options={QUANTITY_UNITS.map((unit) => ({ value: unit, label: unitLabel(unit, line.quantityValue) }))}
          value={line.quantityUnit || undefined}
          onChange={(value) => update({ quantityUnit: (value as QuantityUnit | undefined) ?? '' })}
          readOnly={readOnly}
          need
        />
        ,{' '}
        <TextBlank
          label="days supply"
          placeholder="days"
          kind="number"
          value={line.daysSupply}
          onChange={(daysSupply) => update({ daysSupply })}
          readOnly={readOnly}
          min={1}
        />
        -day supply,{' '}
        <TextBlank
          label="refills"
          kind="number"
          value={line.numberOfRefills}
          onChange={(numberOfRefills) => update({ numberOfRefills })}
          readOnly={readOnly}
          need
          min={0}
        />{' '}
        refills.
      </Sentence>

      <Sentence>
        Directions:{' '}
        <TextBlank
          label="directions"
          width="480px"
          value={line.patientInstructions}
          onChange={(patientInstructions) => update({ patientInstructions })}
          readOnly={readOnly}
          need
        />
      </Sentence>

      <Sentence>
        Note to pharmacy:{' '}
        <TextBlank
          label="note to pharmacy"
          width="520px"
          placeholder="optional"
          value={line.noteToPharmacy}
          onChange={(noteToPharmacy) => update({ noteToPharmacy })}
          readOnly={readOnly}
        />
      </Sentence>

      <Sentence>
        Substitution{' '}
        <SelectBlank
          label="substitution"
          title="Substitution"
          options={SUBSTITUTION_OPTIONS}
          value={line.substitutionAllowed ? 'allowed' : 'not allowed'}
          onChange={(value) => value && update({ substitutionAllowed: value === 'allowed' })}
          readOnly={readOnly}
        />
        .
      </Sentence>

      {errors.length > 0 && (
        <FormHelperText error sx={{ mt: '-8px' }}>
          {errors.join('. ')}.
        </FormHelperText>
      )}
    </Box>
  );
};
