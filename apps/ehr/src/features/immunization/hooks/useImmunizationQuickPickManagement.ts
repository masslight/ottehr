import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { createImmunizationQuickPick, getImmunizationQuickPicks, updateImmunizationQuickPick } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { sortQuickPicks, useMergedImmunizationQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { BASE_ROUTE_OPTIONS } from 'src/shared/utils/options';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { ImmunizationFormValues } from '../components/immunizationLines';

interface UseImmunizationQuickPickManagementProps {
  /** The values a quick pick is saved from: the line the save dialog was opened for. */
  getValues: () => Partial<ImmunizationFormValues>;
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

/** The practice's immunization quick picks and the admins' save dialog; a pick is applied by the caller with
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
    const values = getValues();
    const parts: string[] = [];
    if (values.details?.medication?.name) parts.push(values.details.medication.name);
    if (values.details?.dose) parts.push(values.details.dose);
    if (values.details?.units) parts.push(values.details.units);
    if (values.details?.route) {
      const { route } = values.details;
      const routeName = BASE_ROUTE_OPTIONS.find((opt) => opt.code === route)?.name;
      parts.push(routeName ?? route);
    }
    if (values.details?.location?.name) parts.push(values.details.location.name);
    if (values.administrationDetails?.lot) parts.push(`lot: ${values.administrationDetails.lot}`);
    if (values.administrationDetails?.expDate) parts.push(`exp: ${values.administrationDetails.expDate}`);
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
      const values = getValues();
      const quickPickData: Omit<ImmunizationQuickPickData, 'id'> = {
        name: quickPickName.trim(),
        vaccine: values.details?.medication,
        dose: values.details?.dose,
        units: values.details?.units,
        route: values.details?.route,
        location: values.details?.location,
        manufacturer: values.details?.manufacturer,
        instructions: values.details?.instructions,
        cvx: values.administrationDetails?.cvx,
        mvx: values.administrationDetails?.mvx,
        cptCodes: values.administrationDetails?.cptCodes,
        ndc: values.administrationDetails?.ndc,
        lot: values.administrationDetails?.lot,
        expDate: values.administrationDetails?.expDate,
      };

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
