import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { createImmunizationQuickPick, getImmunizationQuickPicks, updateImmunizationQuickPick } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { sortQuickPicks, useMergedImmunizationQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { BASE_ROUTE_OPTIONS } from 'src/shared/utils/options';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { ImmunizationFormValues, immunizationQuickPickFrom } from '../components/immunizationForm';

interface UseImmunizationQuickPickManagementProps {
  /** The form's values as they stand when a quick pick is saved from them. */
  getValues: () => ImmunizationFormValues;
}

interface UseImmunizationQuickPickManagementReturn {
  mergedQuickPicks: ImmunizationQuickPickData[];
  mergedQuickPicksLoading: boolean;
  quickPickDialogOpen: boolean;
  setQuickPickDialogOpen: (open: boolean) => void;
  quickPickName: string;
  setQuickPickName: (name: string) => void;
  existingQuickPicks: ImmunizationQuickPickData[];
  quickPickSaving: boolean;
  openQuickPickDialog: () => Promise<void>;
  onSaveAsQuickPick: (overwriteId?: string) => Promise<void>;
}

/** The practice's immunization quick picks and the admins' save dialog. The caller applies a pick to its form with
 * `applyImmunizationQuickPick`. */
export const useImmunizationQuickPickManagement = ({
  getValues,
}: UseImmunizationQuickPickManagementProps): UseImmunizationQuickPickManagementReturn => {
  const { oystehrZambda } = useApiClients();
  const {
    quickPicks: mergedQuickPicks,
    loading: mergedQuickPicksLoading,
    refetch: refetchQuickPicks,
  } = useMergedImmunizationQuickPicks();
  const [quickPickDialogOpen, setQuickPickDialogOpen] = useState(false);
  const [quickPickName, setQuickPickName] = useState('');
  const [existingQuickPicks, setExistingQuickPicks] = useState<ImmunizationQuickPickData[]>([]);
  const [quickPickSaving, setQuickPickSaving] = useState(false);

  const openQuickPickDialog = async (): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const response = await getImmunizationQuickPicks(oystehrZambda);
      setExistingQuickPicks([...response.quickPicks].sort(sortQuickPicks));
    } catch (error) {
      console.error('Failed to load existing quick picks:', error);
      setExistingQuickPicks(mergedQuickPicks);
    }
    const { details, administrationDetails } = getValues();
    const parts: string[] = [];
    if (details.medication?.name) parts.push(details.medication.name);
    if (details.dose) parts.push(details.dose);
    if (details.units) parts.push(details.units);
    if (details.route) {
      const { route } = details;
      const routeName = BASE_ROUTE_OPTIONS.find((opt) => opt.code === route)?.name;
      parts.push(routeName ?? route);
    }
    if (details.location?.name) parts.push(details.location.name);
    if (administrationDetails.lot) parts.push(`lot: ${administrationDetails.lot}`);
    if (administrationDetails.expDate) parts.push(`exp: ${administrationDetails.expDate}`);
    setQuickPickName(parts.join(' | '));
    setQuickPickDialogOpen(true);
  };

  const onSaveAsQuickPick = async (overwriteId?: string): Promise<void> => {
    if (!quickPickName.trim()) {
      enqueueSnackbar('Quick pick name is required', { variant: 'error' });
      return;
    }
    if (!oystehrZambda) throw new Error('oystehrZambda was null');

    setQuickPickSaving(true);
    try {
      const quickPickData = immunizationQuickPickFrom(getValues(), quickPickName.trim());

      if (overwriteId) {
        await updateImmunizationQuickPick(oystehrZambda, overwriteId, quickPickData);
        enqueueSnackbar(`Quick pick "${quickPickName}" updated`, { variant: 'success' });
      } else {
        await createImmunizationQuickPick(oystehrZambda, { quickPick: quickPickData });
        enqueueSnackbar(`Quick pick "${quickPickName}" created`, { variant: 'success' });
      }
      setQuickPickDialogOpen(false);
      void refetchQuickPicks();
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
    } finally {
      setQuickPickSaving(false);
    }
  };

  return {
    mergedQuickPicks,
    mergedQuickPicksLoading,
    quickPickDialogOpen,
    setQuickPickDialogOpen,
    quickPickName,
    setQuickPickName,
    existingQuickPicks,
    quickPickSaving,
    openQuickPickDialog,
    onSaveAsQuickPick,
  };
};
