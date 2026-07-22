import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Button,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { ClearIcon } from '@mui/x-date-pickers';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  useGetCPTHCPCSSearch,
  useICD10SearchNew,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useChartData, useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPTCodeDTO, DiagnosisDTO, LATERALITY_SELECTORS, LateralityValue, radiologyStudiesConfig } from 'utils';

/**
 * Field state, search wiring, and chart-data plumbing shared by the in-house
 * (CreateRadiologyOrder) and external (CreateExternalRadiologyOrder) order forms.
 * Mode-specific fields (quick picks, consent, STAT / safety flags, time window,
 * performing organization) stay in the respective page components.
 */

export interface RadiologyOrderFormInitialValues {
  orderDx?: DiagnosisDTO[];
  orderCpt?: CPTCodeDTO;
  studyName?: string;
  clinicalHistory?: string;
  laterality?: LateralityValue | '';
}

export interface UseRadiologyOrderFormResult {
  orderDx: DiagnosisDTO[];
  setOrderDx: React.Dispatch<React.SetStateAction<DiagnosisDTO[]>>;
  orderCpt: CPTCodeDTO | undefined;
  setOrderCpt: React.Dispatch<React.SetStateAction<CPTCodeDTO | undefined>>;
  studyName: string | undefined;
  setStudyName: React.Dispatch<React.SetStateAction<string | undefined>>;
  clinicalHistory: string;
  setClinicalHistory: React.Dispatch<React.SetStateAction<string>>;
  laterality: LateralityValue | '';
  setLaterality: React.Dispatch<React.SetStateAction<LateralityValue | ''>>;
  /** modifier payload derived from the current laterality selection */
  lateralityModifier: { display: string; code: string } | undefined;
  dxSearch: {
    // encounter diagnoses (DiagnosisDTO) or raw ICD-10 search results
    options: { code: string; display: string }[];
    loading: boolean;
    noOptionsText: string;
    onInputChange: (value: string) => void;
  };
  cptSearch: {
    // CPT search results or the static radiologyStudiesConfig fallback (optional codes)
    options: { code?: string; display?: string }[];
    loading: boolean;
    noOptionsText: string;
    onInputChange: (value: string) => void;
  };
  /** saves any order diagnoses not yet on the encounter to the chart before submitting */
  addAdditionalDxToEncounter: () => Promise<void>;
  chartCptCodes: CPTCodeDTO[];
  setPartialChartData: ReturnType<typeof useChartData>['setPartialChartData'];
}

export const useRadiologyOrderForm = (initial?: RadiologyOrderFormInitialValues): UseRadiologyOrderFormResult => {
  const { mutate: saveChartData } = useSaveChartData();
  const { chartData, setPartialChartData } = useChartData();
  const { diagnosis } = chartData || {};
  const primaryDiagnosis = diagnosis?.find((d) => d.isPrimary);

  const [orderDx, setOrderDx] = useState<DiagnosisDTO[]>(
    initial?.orderDx ?? (primaryDiagnosis ? [primaryDiagnosis] : [])
  );
  const [orderCpt, setOrderCpt] = useState<CPTCodeDTO | undefined>(initial?.orderCpt);
  const [studyName, setStudyName] = useState<string | undefined>(initial?.studyName);
  const [clinicalHistory, setClinicalHistory] = useState<string>(initial?.clinicalHistory ?? '');
  const [laterality, setLaterality] = useState<LateralityValue | ''>(initial?.laterality ?? '');

  // used to fetch dx icd10 codes
  const [dxDebouncedSearchTerm, setDxDebouncedSearchTerm] = useState('');
  const { isFetching: isSearchingDx, data: dxData } = useICD10SearchNew({ search: dxDebouncedSearchTerm });
  const icdSearchOptions = dxDebouncedSearchTerm === '' && diagnosis ? diagnosis : dxData?.codes || [];
  const { debounce: debounceDx } = useDebounce(800);
  const debouncedDxHandleInputChange = (data: string): void => {
    debounceDx(() => setDxDebouncedSearchTerm(data));
  };

  // used to fetch cpt codes
  const [cptDebouncedSearchTerm, setCptDebouncedSearchTerm] = useState('');
  const { isFetching: isSearchingCpt, data: cptData } = useGetCPTHCPCSSearch({
    search: cptDebouncedSearchTerm,
    type: 'cpt',
    radiologyOnly: true, // Only fetch CPT codes related to radiology
  });
  const cptSearchOptions = cptData?.codes || radiologyStudiesConfig;
  const { debounce: debounceCpt } = useDebounce(800);
  const debouncedCptHandleInputChange = (data: string): void => {
    debounceCpt(() => setCptDebouncedSearchTerm(data));
  };

  const lateralityModifier =
    laterality !== '' ? { display: LATERALITY_SELECTORS[laterality].modifierDescription, code: laterality } : undefined;

  const addAdditionalDxToEncounter = async (): Promise<void> => {
    if (orderDx.length === 0) return;

    const newDx = orderDx.filter((dx) => !diagnosis?.some((d) => d.code === dx.code));
    if (newDx.length === 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      saveChartData(
        { diagnosis: newDx },
        {
          onSuccess: (data) => {
            const returnedDiagnosis = data.chartData.diagnosis || [];
            const allDx = [...returnedDiagnosis, ...(diagnosis || [])];
            setPartialChartData({ diagnosis: [...allDx] });
            resolve();
          },
          onError: (err) => reject(err),
        }
      );
    });
  };

  const noOptionsText = (term: string, options: { length: number }): string =>
    term && options.length === 0 ? 'Nothing found for this search criteria' : 'Start typing to load results';

  return {
    orderDx,
    setOrderDx,
    orderCpt,
    setOrderCpt,
    studyName,
    setStudyName,
    clinicalHistory,
    setClinicalHistory,
    laterality,
    setLaterality,
    lateralityModifier,
    dxSearch: {
      options: icdSearchOptions,
      loading: isSearchingDx,
      noOptionsText: noOptionsText(dxDebouncedSearchTerm, icdSearchOptions),
      onInputChange: debouncedDxHandleInputChange,
    },
    cptSearch: {
      options: cptSearchOptions,
      loading: isSearchingCpt,
      noOptionsText: noOptionsText(cptDebouncedSearchTerm, cptSearchOptions),
      onInputChange: debouncedCptHandleInputChange,
    },
    addAdditionalDxToEncounter,
    chartCptCodes: chartData?.cptCodes || [],
    setPartialChartData,
  };
};

/**
 * The five order fields both forms share: Diagnosis, Study Name, Study Type (CPT),
 * Laterality, and Clinical History. Rendered as Grid items — the caller provides the
 * surrounding Grid container and any mode-specific fields around them.
 */
export const RadiologyOrderCoreFields: React.FC<{
  form: UseRadiologyOrderFormResult;
  lateralityLabel?: string;
}> = ({ form, lateralityLabel = 'Laterality Selector' }) => {
  return (
    <>
      <Grid item xs={12}>
        <Autocomplete
          multiple
          disableCloseOnSelect
          id="select-dx"
          size="small"
          fullWidth
          filterOptions={(x) => x}
          filterSelectedOptions
          noOptionsText={form.dxSearch.noOptionsText}
          value={form.orderDx}
          isOptionEqualToValue={(option, value) => value.code === option.code}
          onChange={(_event: any, selectedDx: any) => form.setOrderDx(selectedDx)}
          loading={form.dxSearch.loading}
          options={form.dxSearch.options}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
          renderInput={(params) => (
            <TextField
              {...params}
              onChange={(e) => form.dxSearch.onInputChange(e.target.value)}
              label="Diagnosis"
              placeholder="Select diagnosis from list or search"
              multiline
              InputLabelProps={{ shrink: true }}
            />
          )}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          id="study-name"
          label="Study Name"
          placeholder="Enter study name"
          fullWidth
          multiline
          size="small"
          value={form.studyName || ''}
          onChange={(e) => form.setStudyName(e.target.value)}
        />
      </Grid>
      <Grid item xs={12}>
        <Autocomplete
          blurOnSelect
          id="select-cpt"
          size="small"
          fullWidth
          filterOptions={(x) => x}
          noOptionsText={form.cptSearch.noOptionsText}
          value={form.orderCpt || null}
          isOptionEqualToValue={(option, value) => value.code === option.code}
          onChange={(_event: any, selectedCpt: any) => form.setOrderCpt(selectedCpt)}
          loading={form.cptSearch.loading}
          options={form.cptSearch.options}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
          renderInput={(params) => (
            <TextField
              {...params}
              onChange={(e) => form.cptSearch.onInputChange(e.target.value)}
              label="Study Type"
              placeholder="Search for CPT Code"
              multiline
              InputLabelProps={{ shrink: true }}
            />
          )}
        />
      </Grid>
      <Grid item xs={12}>
        <FormControl fullWidth>
          <InputLabel size="small" id="laterality-selector-label">
            {lateralityLabel}
          </InputLabel>
          <Select
            size="small"
            labelId="laterality-selector-label"
            label={lateralityLabel}
            id="laterality-selector"
            onChange={(e) => form.setLaterality(e.target.value as LateralityValue)}
            value={form.laterality}
            input={
              <OutlinedInput
                label={lateralityLabel}
                endAdornment={
                  form.laterality ? (
                    <InputAdornment sx={{ marginRight: '10px' }} position="end">
                      <IconButton aria-label="clear laterality" onClick={() => form.setLaterality('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }
              />
            }
          >
            {Object.entries(LATERALITY_SELECTORS).map(([selectorKey, selectorDisplay]) => (
              <MenuItem key={selectorKey} value={selectorKey}>
                {`${selectorKey} (${selectorDisplay.uiDisplay})`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12}>
        <TextField
          id="clinical-history"
          label="Clinical History"
          placeholder="Enter clinical history for the radiology order"
          fullWidth
          multiline
          size="small"
          InputLabelProps={{ shrink: !!form.clinicalHistory }}
          value={form.clinicalHistory}
          onChange={(e) => {
            if (e.target.value.length <= 255) form.setClinicalHistory(e.target.value);
          }}
          error={form.clinicalHistory.length > 255}
          helperText={
            form.clinicalHistory.length > 255
              ? 'Clinical history must be 255 characters or less'
              : `${form.clinicalHistory.length}/255 characters`
          }
        />
      </Grid>
    </>
  );
};

/**
 * Cancel/submit row plus the error list, shared by both forms.
 */
export const RadiologyOrderFormActions: React.FC<{
  appointmentId: string;
  submitting: boolean;
  submitLabel: string;
  errors: string[] | undefined;
}> = ({ appointmentId, submitting, submitLabel, errors }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  return (
    <>
      <Grid item xs={6}>
        <Button
          variant="outlined"
          sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
          onClick={() => navigate(`/in-person/${appointmentId}/radiology`)}
        >
          Cancel
        </Button>
      </Grid>
      <Grid item xs={6} display="flex" justifyContent="flex-end">
        <LoadingButton
          data-testid={dataTestIds.radiologyPage.submitOrderButton}
          loading={submitting}
          type="submit"
          variant="contained"
          sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
        >
          {submitLabel}
        </LoadingButton>
      </Grid>
      {errors &&
        errors.length > 0 &&
        errors.map((msg, idx) => (
          <Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
            <Typography sx={{ color: theme.palette.error.main }}>{msg}</Typography>
          </Grid>
        ))}
    </>
  );
};
