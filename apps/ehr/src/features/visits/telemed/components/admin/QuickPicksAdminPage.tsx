import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Autocomplete, Box, debounce, Tab, TextField } from '@mui/material';
import { ErxSearchAllergensResponse, ErxSearchMedicationsResponse } from '@oystehr/sdk';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import {
  createAllergyQuickPick,
  createMedicalConditionQuickPick,
  createMedicationHistoryQuickPick,
  getAllergyQuickPicks,
  getMedicalConditionQuickPicks,
  getMedicationHistoryQuickPicks,
  removeAllergyQuickPick,
  removeMedicalConditionQuickPick,
  removeMedicationHistoryQuickPick,
} from 'src/api/api';
import {
  ExtractObjectType,
  useGetAllergiesSearch,
  useGetMedicationsSearch,
  useICD10SearchNew,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import { AllergyQuickPickData, MedicalConditionQuickPickData, MedicationHistoryQuickPickData } from 'utils';
import ProcedureQuickPicksPage from './ProcedureQuickPicksPage';
import QuickPickEditor from './QuickPickEditor';

type SubTab = 'procedures' | 'allergies' | 'medical-conditions' | 'medications';

const AllergenSearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onExtraData?: (data: Record<string, string>) => void;
}> = ({ value, onChange, onExtraData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetAllergiesSearch(debouncedSearchTerm);

  const options = useMemo(() => {
    if (!data || isSearching) return [];
    return data.map((allergy) => {
      const brandName = allergy.brandName;
      if (brandName && brandName !== allergy.name) {
        return { ...allergy, name: `${allergy.name} (${brandName})` };
      }
      return allergy;
    });
  }, [data, isSearching]);

  const debouncedSetSearch = useMemo(
    () =>
      debounce((term: string) => {
        if (term.length > 2) {
          setDebouncedSearchTerm(term);
        }
      }, 800),
    []
  );

  const selectedOption = value ? ({ name: value } as ExtractObjectType<ErxSearchAllergensResponse>) : null;

  return (
    <Autocomplete
      value={selectedOption}
      inputValue={searchTerm || value}
      onInputChange={(_e, newInputValue, reason) => {
        if (reason === 'input') {
          setSearchTerm(newInputValue);
          debouncedSetSearch(newInputValue);
        }
      }}
      onChange={(_e, selected) => {
        if (selected) {
          onChange(selected.name);
          onExtraData?.({ allergyId: selected.id?.toString() ?? '' });
          setSearchTerm('');
        } else {
          onChange('');
          onExtraData?.({ allergyId: '' });
        }
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
      isOptionEqualToValue={(option, val) => option.name === val.name}
      options={options}
      loading={isSearching}
      filterOptions={(x) => x}
      fullWidth
      noOptionsText={
        debouncedSearchTerm && debouncedSearchTerm.length > 2 && options.length === 0
          ? 'Nothing found for this search criteria'
          : 'Start typing to load results'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Agent/Substance"
          placeholder="Search allergens..."
          required
          InputLabelProps={{ shrink: true }}
        />
      )}
    />
  );
};

const MedicationSearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onExtraData?: (data: Record<string, string>) => void;
}> = ({ value, onChange, onExtraData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetMedicationsSearch(debouncedSearchTerm);
  const options = data || [];

  const debouncedSetSearch = useMemo(
    () =>
      debounce((term: string) => {
        if (term.length > 2) {
          setDebouncedSearchTerm(term);
        }
      }, 800),
    []
  );

  const selectedOption = value ? ({ name: value } as ExtractObjectType<ErxSearchMedicationsResponse>) : null;

  return (
    <Autocomplete
      value={selectedOption}
      inputValue={searchTerm || value}
      onInputChange={(_e, newInputValue, reason) => {
        if (reason === 'input') {
          setSearchTerm(newInputValue);
          debouncedSetSearch(newInputValue);
        }
      }}
      onChange={(_e, selected) => {
        if (selected) {
          onChange(selected.name);
          onExtraData?.({
            strength: selected.strength ?? '',
            medicationId: selected.id?.toString() ?? '',
          });
          setSearchTerm('');
        } else {
          onChange('');
          onExtraData?.({ strength: '', medicationId: '' });
        }
      }}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : `${option.name}${option.strength ? ` (${option.strength})` : ''}`
      }
      isOptionEqualToValue={(option, val) => option.name === val.name}
      options={options}
      loading={isSearching}
      filterOptions={(x) => x}
      fullWidth
      noOptionsText={
        debouncedSearchTerm && debouncedSearchTerm.length > 2 && options.length === 0
          ? 'Nothing found for this search criteria'
          : 'Start typing to load results'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Medication"
          placeholder="Search medications..."
          required
          InputLabelProps={{ shrink: true }}
        />
      )}
    />
  );
};

const MedicalConditionSearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onExtraData?: (data: Record<string, string>) => void;
}> = ({ value, onChange, onExtraData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useICD10SearchNew({ search: debouncedSearchTerm });
  const options = data?.codes || [];

  const debouncedSetSearch = useMemo(
    () =>
      debounce((term: string) => {
        setDebouncedSearchTerm(term);
      }, 800),
    []
  );

  const selectedOption = value ? { display: value, code: '' } : null;

  return (
    <Autocomplete
      value={selectedOption}
      inputValue={searchTerm || value}
      onInputChange={(_e, newInputValue, reason) => {
        if (reason === 'input') {
          setSearchTerm(newInputValue);
          debouncedSetSearch(newInputValue);
        }
      }}
      onChange={(_e, selected) => {
        if (selected) {
          onChange(selected.display);
          onExtraData?.({ code: selected.code });
          setSearchTerm('');
        } else {
          onChange('');
          onExtraData?.({ code: '' });
        }
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      isOptionEqualToValue={(option, val) => option.display === val.display}
      options={options}
      loading={isSearching}
      filterOptions={(x) => x}
      fullWidth
      noOptionsText={
        debouncedSearchTerm && options.length === 0
          ? 'Nothing found for this search criteria'
          : 'Start typing to load results'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Medical Condition"
          placeholder="Search ICD-10 codes..."
          required
          InputLabelProps={{ shrink: true }}
        />
      )}
    />
  );
};

export default function QuickPicksAdminPage(): ReactElement {
  const [subTab, setSubTab] = useState<SubTab>('procedures');
  const { oystehrZambda } = useApiClients();

  // ── Allergy callbacks ──
  const fetchAllergies = useCallback(async () => {
    if (!oystehrZambda) return [];
    const response = await getAllergyQuickPicks(oystehrZambda);
    return response.quickPicks;
  }, [oystehrZambda]);

  const createAllergy = useCallback(
    async (data: Omit<AllergyQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      const response = await createAllergyQuickPick(oystehrZambda, { quickPick: data });
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const removeAllergy = useCallback(
    async (id: string) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      await removeAllergyQuickPick(oystehrZambda, id);
    },
    [oystehrZambda]
  );

  // ── Medical condition callbacks ──
  const fetchConditions = useCallback(async () => {
    if (!oystehrZambda) return [];
    const response = await getMedicalConditionQuickPicks(oystehrZambda);
    return response.quickPicks;
  }, [oystehrZambda]);

  const createCondition = useCallback(
    async (data: Omit<MedicalConditionQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      const response = await createMedicalConditionQuickPick(oystehrZambda, { quickPick: data });
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const removeCondition = useCallback(
    async (id: string) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      await removeMedicalConditionQuickPick(oystehrZambda, id);
    },
    [oystehrZambda]
  );

  // ── Medication callbacks ──
  const fetchMedications = useCallback(async () => {
    if (!oystehrZambda) return [];
    const response = await getMedicationHistoryQuickPicks(oystehrZambda);
    return response.quickPicks;
  }, [oystehrZambda]);

  const createMedication = useCallback(
    async (data: Omit<MedicationHistoryQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      const response = await createMedicationHistoryQuickPick(oystehrZambda, { quickPick: data });
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const removeMedication = useCallback(
    async (id: string) => {
      if (!oystehrZambda) throw new Error('oystehrZambda was null');
      await removeMedicationHistoryQuickPick(oystehrZambda, id);
    },
    [oystehrZambda]
  );

  return (
    <Box>
      <TabContext value={subTab}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={(_, v) => setSubTab(v)} aria-label="Quick pick categories">
            <Tab label="Procedures" value="procedures" sx={{ textTransform: 'none' }} />
            <Tab label="Allergies" value="allergies" sx={{ textTransform: 'none' }} />
            <Tab label="Medical Conditions" value="medical-conditions" sx={{ textTransform: 'none' }} />
            <Tab label="Medications" value="medications" sx={{ textTransform: 'none' }} />
          </TabList>
        </Box>

        <TabPanel value="procedures" sx={{ px: 0 }}>
          <ProcedureQuickPicksPage />
        </TabPanel>

        <TabPanel value="allergies" sx={{ px: 0 }}>
          <QuickPickEditor<AllergyQuickPickData>
            title="Allergy Quick Picks"
            description="Manage common allergies that appear as quick picks when documenting patient allergies."
            columns={[{ label: 'Name', getValue: (item) => item.name }]}
            fields={[
              {
                key: 'name',
                label: 'Agent/Substance',
                required: true,
                renderField: (value, onValueChange, onExtraData) => (
                  <AllergenSearchField value={value} onChange={onValueChange} onExtraData={onExtraData} />
                ),
              },
            ]}
            editable={false}
            fetchItems={fetchAllergies}
            createItem={createAllergy}
            removeItem={removeAllergy}
            buildItemFromFields={(values) => ({
              name: values.name.trim(),
              ...(values.allergyId ? { allergyId: Number(values.allergyId) } : {}),
            })}
          />
        </TabPanel>

        <TabPanel value="medical-conditions" sx={{ px: 0 }}>
          <QuickPickEditor<MedicalConditionQuickPickData>
            title="Medical Condition Quick Picks"
            description="Manage common medical conditions that appear as quick picks when documenting patient history."
            columns={[
              { label: 'Display Name', getValue: (item) => item.display },
              { label: 'ICD-10 Code', getValue: (item) => item.code ?? '', width: 150 },
            ]}
            fields={[
              {
                key: 'display',
                label: 'Medical Condition',
                required: true,
                renderField: (value, onValueChange, onExtraData) => (
                  <MedicalConditionSearchField value={value} onChange={onValueChange} onExtraData={onExtraData} />
                ),
              },
            ]}
            editable={false}
            fetchItems={fetchConditions}
            createItem={createCondition}
            removeItem={removeCondition}
            buildItemFromFields={(values) => ({
              display: values.display.trim(),
              ...(values.code?.trim() ? { code: values.code.trim() } : {}),
            })}
          />
        </TabPanel>

        <TabPanel value="medications" sx={{ px: 0 }}>
          <QuickPickEditor<MedicationHistoryQuickPickData>
            title="Medication Quick Picks"
            description="Manage common medications that appear as quick picks when documenting current medications."
            columns={[
              { label: 'Name', getValue: (item) => item.name },
              { label: 'Strength', getValue: (item) => item.strength ?? '', width: 150 },
            ]}
            fields={[
              {
                key: 'name',
                label: 'Medication',
                required: true,
                renderField: (value, onValueChange, onExtraData) => (
                  <MedicationSearchField value={value} onChange={onValueChange} onExtraData={onExtraData} />
                ),
              },
            ]}
            editable={false}
            fetchItems={fetchMedications}
            createItem={createMedication}
            removeItem={removeMedication}
            buildItemFromFields={(values) => ({
              name: values.name.trim(),
              ...(values.strength?.trim() ? { strength: values.strength.trim() } : {}),
              ...(values.medicationId ? { medicationId: Number(values.medicationId) } : {}),
            })}
          />
        </TabPanel>
      </TabContext>
    </Box>
  );
}
