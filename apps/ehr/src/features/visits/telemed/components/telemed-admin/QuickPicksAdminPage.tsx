import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import React, { ReactElement, useCallback, useState } from 'react';
import {
  createAllergyQuickPick,
  createMedicalConditionQuickPick,
  createMedicationQuickPick,
  getAllergyQuickPicks,
  getMedicalConditionQuickPicks,
  getMedicationQuickPicks,
  removeAllergyQuickPick,
  removeMedicalConditionQuickPick,
  removeMedicationQuickPick,
  updateAllergyQuickPick,
  updateMedicalConditionQuickPick,
  updateMedicationQuickPick,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { AllergyQuickPickData, MedicalConditionQuickPickData, MedicationQuickPickData } from 'utils';
import ProcedureQuickPicksPage from './ProcedureQuickPicksPage';
import QuickPickEditor from './QuickPickEditor';

type SubTab = 'procedures' | 'allergies' | 'medical-conditions' | 'medications';

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
      if (!oystehrZambda) throw new Error('Not connected');
      const response = await createAllergyQuickPick(oystehrZambda, { quickPick: data });
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const updateAllergy = useCallback(
    async (id: string, data: Omit<AllergyQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const response = await updateAllergyQuickPick(oystehrZambda, id, data);
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const removeAllergy = useCallback(
    async (id: string) => {
      if (!oystehrZambda) throw new Error('Not connected');
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
      if (!oystehrZambda) throw new Error('Not connected');
      const response = await createMedicalConditionQuickPick(oystehrZambda, { quickPick: data });
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const updateCondition = useCallback(
    async (id: string, data: Omit<MedicalConditionQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const response = await updateMedicalConditionQuickPick(oystehrZambda, id, data);
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const removeCondition = useCallback(
    async (id: string) => {
      if (!oystehrZambda) throw new Error('Not connected');
      await removeMedicalConditionQuickPick(oystehrZambda, id);
    },
    [oystehrZambda]
  );

  // ── Medication callbacks ──
  const fetchMedications = useCallback(async () => {
    if (!oystehrZambda) return [];
    const response = await getMedicationQuickPicks(oystehrZambda);
    return response.quickPicks;
  }, [oystehrZambda]);

  const createMedication = useCallback(
    async (data: Omit<MedicationQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const response = await createMedicationQuickPick(oystehrZambda, { quickPick: data });
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const updateMedication = useCallback(
    async (id: string, data: Omit<MedicationQuickPickData, 'id'>) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const response = await updateMedicationQuickPick(oystehrZambda, id, data);
      return response.quickPick;
    },
    [oystehrZambda]
  );

  const removeMedication = useCallback(
    async (id: string) => {
      if (!oystehrZambda) throw new Error('Not connected');
      await removeMedicationQuickPick(oystehrZambda, id);
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
            fields={[{ key: 'name', label: 'Allergy Name', required: true, placeholder: 'e.g. Amoxicillin' }]}
            fetchItems={fetchAllergies}
            createItem={createAllergy}
            updateItem={updateAllergy}
            removeItem={removeAllergy}
            buildItemFromFields={(values) => ({ name: values.name.trim() })}
            getFieldValues={(item) => ({ name: item.name })}
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
              { key: 'display', label: 'Display Name', required: true, placeholder: 'e.g. Asthma' },
              { key: 'code', label: 'ICD-10 Code (optional)', placeholder: 'e.g. J45.909' },
            ]}
            fetchItems={fetchConditions}
            createItem={createCondition}
            updateItem={updateCondition}
            removeItem={removeCondition}
            buildItemFromFields={(values) => ({
              display: values.display.trim(),
              ...(values.code?.trim() ? { code: values.code.trim() } : {}),
            })}
            getFieldValues={(item) => ({ display: item.display, code: item.code ?? '' })}
          />
        </TabPanel>

        <TabPanel value="medications" sx={{ px: 0 }}>
          <QuickPickEditor<MedicationQuickPickData>
            title="Medication Quick Picks"
            description="Manage common medications that appear as quick picks when documenting current medications."
            columns={[
              { label: 'Name', getValue: (item) => item.name },
              { label: 'Strength', getValue: (item) => item.strength ?? '', width: 150 },
            ]}
            fields={[
              { key: 'name', label: 'Medication Name', required: true, placeholder: 'e.g. Amoxicillin' },
              { key: 'strength', label: 'Strength (optional)', placeholder: 'e.g. 500mg' },
            ]}
            fetchItems={fetchMedications}
            createItem={createMedication}
            updateItem={updateMedication}
            removeItem={removeMedication}
            buildItemFromFields={(values) => ({
              name: values.name.trim(),
              ...(values.strength?.trim() ? { strength: values.strength.trim() } : {}),
            })}
            getFieldValues={(item) => ({ name: item.name, strength: item.strength ?? '' })}
          />
        </TabPanel>
      </TabContext>
    </Box>
  );
}
