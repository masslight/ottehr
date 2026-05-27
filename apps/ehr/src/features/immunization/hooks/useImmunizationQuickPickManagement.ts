import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { createImmunizationQuickPick, getImmunizationQuickPicks, updateImmunizationQuickPick } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { sortQuickPicks, useMergedImmunizationQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { ROUTE_OPTIONS } from 'src/shared/utils/options';
import { ImmunizationQuickPickData } from 'utils';

interface UseImmunizationQuickPickManagementProps {
  methods: UseFormReturn;
  /** When true, quick pick apply sets both order details and administration details. When false, only administration details. */
  applyOrderDetails: boolean;
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
  overwriteTarget: ImmunizationQuickPickData | null;
  setOverwriteTarget: (target: ImmunizationQuickPickData | null) => void;
  onQuickPickSelect: (quickPick: ImmunizationQuickPickData) => void;
  openQuickPickDialog: () => Promise<void>;
  onSaveAsQuickPick: (overwriteId?: string) => Promise<void>;
}

export const useImmunizationQuickPickManagement = ({
  methods,
  applyOrderDetails,
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
  const [overwriteTarget, setOverwriteTarget] = useState<ImmunizationQuickPickData | null>(null);

  const onQuickPickSelect = (quickPick: ImmunizationQuickPickData): void => {
    const currentValues = methods.getValues();
    methods.reset({
      ...currentValues,
      ...(applyOrderDetails && {
        details: {
          ...currentValues.details,
          medication: quickPick.vaccine,
          dose: quickPick.dose,
          units: quickPick.units,
          route: quickPick.route,
          location: quickPick.location,
          manufacturer: quickPick.manufacturer,
          instructions: quickPick.instructions,
        },
      }),
      administrationDetails: {
        ...currentValues.administrationDetails,
        lot: quickPick.lot,
        expDate: quickPick.expDate,
        mvx: quickPick.mvx,
        cvx: quickPick.cvx,
        cptCodes: quickPick.cptCodes ?? [],
        ndc: quickPick.ndc,
      },
    });
  };

  const openQuickPickDialog = async (): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const response = await getImmunizationQuickPicks(oystehrZambda);
      setExistingQuickPicks([...response.quickPicks].sort(sortQuickPicks));
    } catch (error) {
      console.error('Failed to load existing quick picks:', error);
      setExistingQuickPicks(mergedQuickPicks);
    }
    const values = methods.getValues();
    const parts: string[] = [];
    if (values.details?.medication?.name) parts.push(values.details.medication.name);
    if (values.details?.dose) parts.push(values.details.dose);
    if (values.details?.units) parts.push(values.details.units);
    if (values.details?.route) {
      const routeName = ROUTE_OPTIONS.find((opt) => opt.code === values.details.route)?.name;
      parts.push(routeName ?? values.details.route);
    }
    if (values.details?.location?.name) parts.push(values.details.location.name);
    if (values.administrationDetails?.lot) parts.push(`lot: ${values.administrationDetails.lot}`);
    if (values.administrationDetails?.expDate) parts.push(`exp: ${values.administrationDetails.expDate}`);
    setQuickPickName(parts.join(' | '));
    setOverwriteTarget(null);
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
      const values = methods.getValues();
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
    overwriteTarget,
    setOverwriteTarget,
    onQuickPickSelect,
    openQuickPickDialog,
    onSaveAsQuickPick,
  };
};
