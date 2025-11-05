import { Add, Delete } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { getProviderStaffPatient } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  deletePatientSettings,
  fetchPatientSettings,
  savePatientSettings,
} from '../../../../packages/zambdas/src/services/patientSettings';

interface Option {
  id: string;
  name: string;
}

interface ProviderOption {
  id: string;
  name: string;
  providerId: string;
}
interface StaffOption {
  id: string;
  name: string;
  staffId: string;
}
interface PatientOption {
  id: string;
  name: string;
  patientId: string;
}

interface Patient {
  id: string;
  name: string;
  is_notification_enabled: boolean;
  is_report_enabled: boolean;
}

interface Staff {
  id: string;
  name: string;
  patients: Patient[];
  is_notification_enabled?: boolean;
  is_report_enabled?: boolean;
}

interface Provider {
  id: string;
  name: string;
  staff: Staff[];
  is_notification_enabled?: boolean;
  is_report_enabled?: boolean;
}

interface ApiUser {
  id: string;
  authenticationMethod: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  profile: string;
  firstName: string;
  lastName: string;
  providerId?: string;
  staffId?: string;
  patientId?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface SavedSetting {
  id: string;
  provider_id: string;
  staff_id: string;
  patient_id: string | null;
  order: number;
  is_notification_enabled: boolean;
  is_report_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface DeleteModalState {
  open: boolean;
  type: 'provider' | 'staff' | 'patient';
  providerId?: string;
  staffId?: string;
  patientId?: string;
  name: string;
}

interface NotificationModalState {
  open: boolean;
  providerId?: string;
  staffId?: string;
  patientId?: string;
  currentValue: boolean;
  type: 'notification' | 'report';
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

export const NotificationHierarchy = (): JSX.Element => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<Record<string, StaffOption[]>>({});
  const [patientOptions, setPatientOptions] = useState<Record<string, PatientOption[]>>({});
  const [selectedPatientIds, setSelectedPatientIds] = useState<Record<string, string[]>>({});
  const { oystehrZambda } = useApiClients();
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState<Record<string, boolean>>({});
  const [showPatientDropdown, setShowPatientDropdown] = useState<Record<string, boolean>>({});
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    open: false,
    type: 'provider',
    name: '',
  });
  const [notificationModal, setNotificationModal] = useState<NotificationModalState>({
    open: false,
    currentValue: false,
    type: 'notification',
  });
  const [originalApiData, setOriginalApiData] = useState<{
    providers: ApiUser[];
    staff: ApiUser[];
    patients: ApiUser[];
  }>({
    providers: [],
    staff: [],
    patients: [],
  });

  const getFullName = (user: ApiUser): string => {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name;
  };

  const showSnackbar = (message: string, severity: SnackbarState['severity'] = 'success'): void => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string): any => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const openDeleteModal = (
    type: 'provider' | 'staff' | 'patient',
    name: string,
    providerId?: string,
    staffId?: string,
    patientId?: string
  ): void => {
    setDeleteModal({
      open: true,
      type,
      providerId,
      staffId,
      patientId,
      name,
    });
  };

  const closeDeleteModal = (): void => {
    setDeleteModal({
      open: false,
      type: 'provider',
      name: '',
    });
  };

  const openNotificationModal = (
    providerId: string,
    staffId: string,
    patientId: string,
    currentValue: boolean,
    type: 'notification' | 'report'
  ): void => {
    setNotificationModal({
      open: true,
      providerId,
      staffId,
      patientId,
      currentValue,
      type,
    });
  };

  const closeNotificationModal = (): void => {
    setNotificationModal({
      open: false,
      currentValue: false,
      type: 'notification',
    });
  };

  const handleConfirmNotificationToggle = (): void => {
    const { providerId, staffId, patientId, type } = notificationModal;

    if (providerId && staffId && patientId) {
      if (type === 'notification') {
        handlePatientNotificationToggle(providerId, staffId, patientId);
      } else {
        handlePatientReportToggle(providerId, staffId, patientId);
      }
    }

    closeNotificationModal();
  };

  const handlePatientSelectionChange = (staffId: string, patientIds: string[]): void => {
    setSelectedPatientIds((prev) => ({
      ...prev,
      [staffId]: patientIds,
    }));
  };

  const handleAddSelectedPatients = (providerId: string, staffId: string): void => {
    const selectedIds = selectedPatientIds[staffId] || [];

    if (selectedIds.length === 0) {
      showSnackbar('Please select at least one patient', 'warning');
      return;
    }

    const selectedPatients = patientOptions.global?.filter((p) => selectedIds.includes(p.id)) || [];

    setProviders((prev) =>
      prev.map((prov) =>
        prov.id === providerId
          ? {
              ...prov,
              staff: prov.staff.map((st) =>
                st.id === staffId
                  ? {
                      ...st,
                      patients: [
                        ...selectedPatients.map((patient) => ({
                          id: patient.id,
                          name: patient.name,
                          is_notification_enabled: true,
                          is_report_enabled: true,
                        })),
                        ...st.patients,
                      ],
                    }
                  : st
              ),
            }
          : prov
      )
    );

    setSelectedPatientIds((prev) => ({
      ...prev,
      [staffId]: [],
    }));

    setShowPatientDropdown((prev) => ({ ...prev, [staffId]: false }));
  };

  const handleCancelPatientSelection = (staffId: string): void => {
    setSelectedPatientIds((prev) => ({
      ...prev,
      [staffId]: [],
    }));
    setShowPatientDropdown((prev) => ({ ...prev, [staffId]: false }));
  };

  const handleConfirmDelete = (): void => {
    const { type, providerId, staffId, patientId } = deleteModal;

    const existsInDatabase = checkExistsInDatabase(type, providerId, staffId, patientId);

    switch (type) {
      case 'provider':
        if (providerId) removeProvider(providerId);
        break;
      case 'staff':
        if (providerId && staffId) removeStaff(providerId, staffId);
        break;
      case 'patient':
        if (providerId && staffId && patientId) removePatient(providerId, staffId, patientId);
        break;
    }

    if (existsInDatabase) {
      deleteSettingsMutation.mutate({
        type,
        providerId,
        staffId,
        patientId,
      });
    } else {
      showSnackbar('Deleted successfully!', 'success');
    }

    closeDeleteModal();
  };

  const getSelectedProviderIds = useCallback((): string[] => {
    return providers.map((provider) => provider.id);
  }, [providers]);

  const getSelectedStaffIds = useCallback(
    (providerId: string): string[] => {
      const provider = providers.find((p) => p.id === providerId);
      return provider ? provider.staff.map((staff) => staff.id) : [];
    },
    [providers]
  );

  const getProviderProfileId = (uiId: string): string => {
    const provider = originalApiData.providers.find((p) => p.id === uiId);
    return provider?.providerId || uiId;
  };

  const getStaffProfileId = (uiId: string): string => {
    const staff = originalApiData.staff.find((s) => s.id === uiId);
    return staff?.staffId || uiId;
  };

  const getPatientProfileId = (uiId: string): string => {
    const patient = originalApiData.patients.find((p) => p.id === uiId);
    return patient?.patientId || uiId;
  };

  const getSelectedPatientIds = useCallback(
    (providerId: string, staffId: string): string[] => {
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return [];

      const staff = provider.staff.find((s) => s.id === staffId);
      return staff ? staff.patients.map((patient) => patient.id) : [];
    },
    [providers]
  );

  const getAvailableProviderOptions = useCallback((): Option[] => {
    const selectedIds = getSelectedProviderIds();
    return providerOptions.filter((option) => !selectedIds.includes(option.id));
  }, [providerOptions, getSelectedProviderIds]);

  const getAvailableStaffOptions = useCallback(
    (providerId: string): Option[] => {
      const selectedIds = getSelectedStaffIds(providerId);
      return staffOptions.global?.filter((option) => !selectedIds.includes(option.id)) || [];
    },
    [staffOptions, getSelectedStaffIds]
  );

  const getAvailablePatientOptions = useCallback(
    (providerId: string, staffId: string): Option[] => {
      const selectedIds = getSelectedPatientIds(providerId, staffId);
      return patientOptions.global?.filter((option) => !selectedIds.includes(option.id)) || [];
    },
    [patientOptions, getSelectedPatientIds]
  );

  const { data: providerData, isLoading: providerLoading } = useQuery(
    ['get-providers', { oystehrZambda }],
    () => {
      if (oystehrZambda) {
        const payload = { resourceType: 'Provider' };
        return getProviderStaffPatient(payload, oystehrZambda);
      }
      return null;
    },
    {
      enabled: !!oystehrZambda,
      onSuccess: (data) => {
        if (data) {
          setOriginalApiData((prev) => ({ ...prev, providers: data }));
        }
      },
      select: (data) => {
        if (data?.providerList) {
          return data.providerList.map((provider: ApiUser) => ({
            id: provider.id,
            name: getFullName(provider),
            providerId: provider.providerId,
          }));
        }
        return [];
      },
    }
  );

  const { data: staffData, isLoading: staffLoading } = useQuery(
    ['get-staff', { oystehrZambda }],
    () => {
      if (oystehrZambda) {
        const payload = { resourceType: 'Staff' };
        return getProviderStaffPatient(payload, oystehrZambda);
      }
      return null;
    },
    {
      enabled: !!oystehrZambda,
      onSuccess: (data) => {
        if (data) {
          setOriginalApiData((prev) => ({ ...prev, staff: data }));
        }
      },
      select: (data) => {
        if (data?.staffList) {
          return data.staffList.map((staff: ApiUser) => ({
            id: staff.id,
            name: getFullName(staff),
            staffId: staff.staffId,
          }));
        }
        return [];
      },
    }
  );

  const { data: patientData, isLoading: patientLoading } = useQuery(
    ['get-patients', { oystehrZambda }],
    () => {
      if (oystehrZambda) {
        const payload = { resourceType: 'Patient' };
        return getProviderStaffPatient(payload, oystehrZambda);
      }
      return null;
    },
    {
      enabled: !!oystehrZambda,
      onSuccess: (data) => {
        if (data) {
          setOriginalApiData((prev) => ({ ...prev, patients: data }));
        }
      },
      select: (data) => {
        if (data?.patientList) {
          return data.patientList.map((patient: ApiUser) => ({
            id: patient.id,
            name: getFullName(patient),
            patientId: patient.patientId,
          }));
        }
        return [];
      },
    }
  );

  const {
    data: savedSettingsData,
    isLoading: settingsLoading,
    refetch: refetchSettings,
  } = useQuery(['patient-settings'], () => fetchPatientSettings(), {
    enabled: true,
    onSuccess: (data) => {
      if (data?.settings) {
        transformSavedSettingsToHierarchy(data.settings);
      }
    },
    onError: (error) => {
      console.error('Failed to fetch patient settings:', error);
    },
  });

  const checkExistsInDatabase = useCallback(
    (type: 'provider' | 'staff' | 'patient', providerId?: string, staffId?: string, patientId?: string): boolean => {
      if (!savedSettingsData?.settings) return false;

      switch (type) {
        case 'provider':
          return providerId ? savedSettingsData.settings.some((s: any) => s.provider_id === providerId) : false;

        case 'staff':
          return providerId && staffId
            ? savedSettingsData.settings.some((s: any) => s.provider_id === providerId && s.staff_id === staffId)
            : false;

        case 'patient':
          return providerId && staffId && patientId
            ? savedSettingsData.settings.some(
                (s: any) => s.provider_id === providerId && s.staff_id === staffId && s.patient_id === patientId
              )
            : false;

        default:
          return false;
      }
    },
    [savedSettingsData]
  );

  const transformSavedSettingsToHierarchy = useCallback(
    (savedSettings: SavedSetting[]) => {
      const validSettings = savedSettings.filter(
        (setting) => setting.staff_id !== null && setting.staff_id !== undefined
      );

      const sortedSettings = [...validSettings].sort((a, b) => a.order - b.order);

      const hierarchy: Provider[] = [];
      const providerMap = new Map<string, Provider>();
      const staffMap = new Map<string, Staff>();
      const providerNameMap = new Map(providerOptions.map((p) => [p.providerId, p.name]));
      const staffNameMap = new Map(staffOptions.global?.map((s) => [s.staffId, s.name]) || []);
      const patientNameMap = new Map(patientOptions.global?.map((p) => [p.patientId, p.name]) || []);

      sortedSettings.forEach((setting) => {
        if (!setting.staff_id) return;
        if (!providerMap.has(setting.provider_id)) {
          const providerName = providerNameMap.get(setting.provider_id) || `Provider ${setting.provider_id}`;
          const provider: Provider = {
            id: setting.provider_id,
            name: providerName,
            staff: [],
          };
          providerMap.set(setting.provider_id, provider);
          hierarchy.push(provider);
        }

        const provider = providerMap.get(setting.provider_id)!;
        const staffKey = `${setting.provider_id}-${setting.staff_id}`;
        if (!staffMap.has(staffKey)) {
          const staffName = staffNameMap.get(setting.staff_id) || `Staff ${setting.staff_id}`;
          const staff: Staff = {
            id: setting.staff_id,
            name: staffName,
            patients: [],
          };
          staffMap.set(staffKey, staff);
          provider.staff.push(staff);
        }

        const staff = staffMap.get(staffKey)!;

        if (setting.patient_id) {
          const patientName = patientNameMap.get(setting.patient_id) || `Patient ${setting.patient_id}`;
          const patient: Patient = {
            id: setting.patient_id,
            name: patientName,
            is_notification_enabled: setting.is_notification_enabled,
            is_report_enabled: setting.is_report_enabled,
          };
          staff.patients.push(patient);
        }
      });

      setProviders(hierarchy);
    },
    [providerOptions, staffOptions.global, patientOptions.global]
  );

  const deleteSettingsMutation = useMutation(
    (deleteData: {
      type: 'provider' | 'staff' | 'patient';
      providerId?: string;
      staffId?: string;
      patientId?: string;
    }) => {
      return deletePatientSettings(deleteData);
    },
    {
      onSuccess: () => {
        showSnackbar('Deleted successfully!', 'success');
      },
      onError: (error: any) => {
        console.error('Failed to delete:', error);
        showSnackbar('Failed to delete. Please try again.', 'error');
      },
    }
  );

  const saveSettingsMutation = useMutation(
    (
      settingsData: Array<{
        provider_id: string;
        staff_id: string;
        patient_id: string | null;
        order: number;
        is_notification_enabled: boolean;
        is_report_enabled: boolean;
      }>
    ) => {
      return savePatientSettings(settingsData);
    },
    {
      onSuccess: async () => {
        showSnackbar('Patient settings saved successfully!', 'success');
        await refetchSettings();
      },
      onError: (error: any) => {
        console.error('Failed to save patient settings:', error);
        showSnackbar('Failed to save patient settings. Please try again.', 'error');
      },
    }
  );

  useEffect(() => {
    if (providerData) {
      setProviderOptions(providerData);
    }
  }, [providerData]);

  useEffect(() => {
    if (staffData) {
      setStaffOptions((prev) => ({ ...prev, global: staffData }));
    }
  }, [staffData]);

  useEffect(() => {
    if (patientData) {
      setPatientOptions((prev) => ({ ...prev, global: patientData }));
    }
  }, [patientData]);

  useEffect(() => {
    if (savedSettingsData?.settings && providerOptions.length > 0 && staffOptions.global && patientOptions.global) {
      transformSavedSettingsToHierarchy(savedSettingsData.settings);
    }
  }, [
    savedSettingsData,
    providerOptions,
    staffOptions.global,
    patientOptions.global,
    transformSavedSettingsToHierarchy,
  ]);

  const handleProviderSelect = (providerId: string): void => {
    const selectedProvider = providerOptions.find((p) => p.id === providerId);
    if (!selectedProvider) return;

    setProviders((prev) => [{ id: selectedProvider.id, name: selectedProvider.name, staff: [] }, ...prev]);
    setShowProviderDropdown(false);
  };

  const handleStaffSelect = (providerId: string, staffId: string): void => {
    const selectedStaff = staffOptions.global?.find((s) => s.id === staffId);
    if (!selectedStaff) return;

    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, staff: [{ id: staffId, name: selectedStaff.name, patients: [] }, ...p.staff] } : p
      )
    );

    setShowStaffDropdown((prev) => ({ ...prev, [providerId]: false }));
  };

  const handlePatientNotificationToggle = (providerId: string, staffId: string, patientId: string): void => {
    setProviders((prev) =>
      prev.map((prov) =>
        prov.id === providerId
          ? {
              ...prov,
              staff: prov.staff.map((st) =>
                st.id === staffId
                  ? {
                      ...st,
                      patients: st.patients.map((pt) =>
                        pt.id === patientId ? { ...pt, is_notification_enabled: !pt.is_notification_enabled } : pt
                      ),
                    }
                  : st
              ),
            }
          : prov
      )
    );
  };

  const handlePatientReportToggle = (providerId: string, staffId: string, patientId: string): void => {
    setProviders((prev) =>
      prev.map((prov) =>
        prov.id === providerId
          ? {
              ...prov,
              staff: prov.staff.map((st) =>
                st.id === staffId
                  ? {
                      ...st,
                      patients: st.patients.map((pt) =>
                        pt.id === patientId ? { ...pt, is_report_enabled: !pt.is_report_enabled } : pt
                      ),
                    }
                  : st
              ),
            }
          : prov
      )
    );
  };

  const removeProvider = (providerId: string): void => {
    setProviders((prev) => prev.filter((p) => p.id !== providerId));
  };

  const removeStaff = (providerId: string, staffId: string): void => {
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, staff: p.staff.filter((s) => s.id !== staffId) } : p))
    );
  };

  const removePatient = (providerId: string, staffId: string, patientId: string): void => {
    setProviders((prev) =>
      prev.map((prov) =>
        prov.id === providerId
          ? {
              ...prov,
              staff: prov.staff.map((st) =>
                st.id === staffId ? { ...st, patients: st.patients.filter((pt) => pt.id !== patientId) } : st
              ),
            }
          : prov
      )
    );
  };

  const handleSave = (): void => {
    const settingsData: Array<{
      provider_id: string;
      staff_id: string;
      patient_id: string | null;
      order: number;
      is_notification_enabled: boolean;
      is_report_enabled: boolean;
    }> = [];

    let orderCounter = 1;

    providers.forEach((provider) => {
      const providerProfileId = getProviderProfileId(provider.id);

      provider.staff.forEach((staff) => {
        const staffProfileId = getStaffProfileId(staff.id);

        if (staff.patients.length > 0) {
          staff.patients.forEach((patient) => {
            const patientProfileId = getPatientProfileId(patient.id);

            settingsData.push({
              provider_id: providerProfileId,
              staff_id: staffProfileId,
              patient_id: patientProfileId,
              order: orderCounter++,
              is_notification_enabled: patient.is_notification_enabled,
              is_report_enabled: patient.is_report_enabled,
            });
          });
        } else {
          settingsData.push({
            provider_id: providerProfileId,
            staff_id: staffProfileId,
            patient_id: null,
            order: orderCounter++,
            is_notification_enabled: true,
            is_report_enabled: true,
          });
        }
      });
    });

    saveSettingsMutation.mutate(settingsData);
  };

  const handleCancel = (): void => {
    if (savedSettingsData?.settings) {
      transformSavedSettingsToHierarchy(savedSettingsData.settings);
    } else {
      setProviders([]);
    }
    setShowProviderDropdown(false);
    setShowStaffDropdown({});
    setShowPatientDropdown({});
    showSnackbar('Changes cancelled', 'info');
  };

  const isLoading = providerLoading || staffLoading || patientLoading || settingsLoading;
  const isSaving = saveSettingsMutation.isLoading;
  const isDeleting = deleteSettingsMutation.isLoading;

  return (
    <>
      <Typography variant="h4" color="primary.dark">
        Notification Settings
      </Typography>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3} mt={3}>
          {!showProviderDropdown && !settingsLoading && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setShowProviderDropdown(true)}
              sx={{ width: 'fit-content' }}
              disabled={isLoading || getAvailableProviderOptions().length === 0}
            >
              {isLoading ? 'Loading...' : 'Add Provider'}
            </Button>
          )}

          {showProviderDropdown && (
            <FormControl size="small" sx={{ width: 300 }}>
              {isLoading ? (
                <CircularProgress size={20} />
              ) : (
                <Select displayEmpty defaultValue="" onChange={(e) => handleProviderSelect(e.target.value)}>
                  <MenuItem value="" disabled>
                    Select Provider
                  </MenuItem>
                  {getAvailableProviderOptions().map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} (Provider)
                    </MenuItem>
                  ))}
                  {getAvailableProviderOptions().length === 0 && (
                    <MenuItem value="" disabled>
                      No more providers available
                    </MenuItem>
                  )}
                </Select>
              )}
            </FormControl>
          )}

          {providers.map((provider) => {
            const availableStaffOptions = getAvailableStaffOptions(provider.id);

            return (
              <Card key={provider.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">{provider.name} (Provider)</Typography>
                    <IconButton
                      onClick={() => openDeleteModal('provider', provider.name, provider.id)}
                      disabled={isDeleting}
                    >
                      <Delete titleAccess="Delete Provider" style={{ color: '#f34343ff' }} fontSize="small" />
                    </IconButton>
                  </Stack>

                  {!showStaffDropdown[provider.id] && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Add />}
                      onClick={() => setShowStaffDropdown((prev) => ({ ...prev, [provider.id]: true }))}
                      sx={{ mt: 2, width: 'fit-content' }}
                      disabled={isLoading || availableStaffOptions.length === 0}
                    >
                      {isLoading ? 'Loading...' : 'Add MA'}
                    </Button>
                  )}

                  {showStaffDropdown[provider.id] && (
                    <FormControl size="small" sx={{ width: 300, mt: 2 }}>
                      {isLoading ? (
                        <CircularProgress size={20} />
                      ) : (
                        <Select
                          displayEmpty
                          defaultValue=""
                          onChange={(e) => handleStaffSelect(provider.id, e.target.value)}
                        >
                          <MenuItem value="" disabled>
                            Select MA
                          </MenuItem>
                          {availableStaffOptions.map((s) => (
                            <MenuItem key={s.id} value={s.id}>
                              {s.name} (MA)
                            </MenuItem>
                          ))}
                          {availableStaffOptions.length === 0 && (
                            <MenuItem value="" disabled>
                              No more MA available
                            </MenuItem>
                          )}
                        </Select>
                      )}
                    </FormControl>
                  )}

                  <Stack spacing={2} mt={2}>
                    {provider.staff.map((staff) => {
                      const availablePatientOptions = getAvailablePatientOptions(provider.id, staff.id);

                      return (
                        <Card key={staff.id} variant="outlined" sx={{ borderRadius: 2 }}>
                          <CardContent>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Typography variant="subtitle1">{staff.name} (MA)</Typography>
                              <IconButton
                                onClick={() => openDeleteModal('staff', staff.name, provider.id, staff.id)}
                                disabled={isDeleting}
                              >
                                <Delete titleAccess="Delete MA" style={{ color: '#f34343ff' }} fontSize="small" />
                              </IconButton>
                            </Stack>

                            {!showPatientDropdown[staff.id] && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Add />}
                                onClick={() => setShowPatientDropdown((prev) => ({ ...prev, [staff.id]: true }))}
                                sx={{ mt: 2, width: 'fit-content' }}
                                disabled={isLoading || availablePatientOptions.length === 0}
                              >
                                {isLoading ? 'Loading...' : 'Add Patient'}
                              </Button>
                            )}

                            {showPatientDropdown[staff.id] && (
                              <Box sx={{ mt: 2 }}>
                                <FormControl size="small" sx={{ width: 300 }}>
                                  <InputLabel>Select Patients</InputLabel>
                                  <Select
                                    multiple
                                    value={selectedPatientIds[staff.id] || []}
                                    onChange={(e) => handlePatientSelectionChange(staff.id, e.target.value as string[])}
                                    input={<OutlinedInput label="Select Patients" />}
                                    renderValue={(selected) => {
                                      const selectedNames = selected.map((id) => {
                                        const patient = patientOptions.global?.find((p) => p.id === id);
                                        return patient ? `${patient.name} (Patient)` : '';
                                      });
                                      return selectedNames.length > 0
                                        ? `${selectedNames.length} patient(s) selected`
                                        : 'Select Patients';
                                    }}
                                    MenuProps={MenuProps}
                                  >
                                    {availablePatientOptions.map((pt) => (
                                      <MenuItem key={pt.id} value={pt.id}>
                                        <Checkbox checked={(selectedPatientIds[staff.id] || []).includes(pt.id)} />
                                        <ListItemText primary={`${pt.name} (Patient)`} />
                                      </MenuItem>
                                    ))}
                                    {availablePatientOptions.length === 0 && (
                                      <MenuItem value="" disabled>
                                        No more patients available
                                      </MenuItem>
                                    )}
                                  </Select>
                                </FormControl>

                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    onClick={() => handleAddSelectedPatients(provider.id, staff.id)}
                                    disabled={(selectedPatientIds[staff.id] || []).length === 0}
                                  >
                                    OK
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => handleCancelPatientSelection(staff.id)}
                                  >
                                    Cancel
                                  </Button>
                                </Stack>

                                {(selectedPatientIds[staff.id] || []).length > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ mt: 0.5, display: 'block' }}
                                  >
                                    {(selectedPatientIds[staff.id] || []).length} patient(s) selected
                                  </Typography>
                                )}
                              </Box>
                            )}

                            <Stack spacing={1} mt={2}>
                              {staff.patients.map((patient) => (
                                <Box
                                  key={patient.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 1,
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 1,
                                  }}
                                >
                                  <Typography>{patient.name} (Patient)</Typography>
                                  <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="body2">Report</Typography>
                                    <Switch
                                      size="small"
                                      checked={patient.is_report_enabled}
                                      onClick={() =>
                                        openNotificationModal(
                                          provider.id,
                                          staff.id,
                                          patient.id,
                                          patient.is_report_enabled,
                                          'report'
                                        )
                                      }
                                    />
                                    <Typography variant="body2">Notification</Typography>
                                    <Switch
                                      size="small"
                                      checked={patient.is_notification_enabled}
                                      onClick={() =>
                                        openNotificationModal(
                                          provider.id,
                                          staff.id,
                                          patient.id,
                                          patient.is_notification_enabled,
                                          'notification'
                                        )
                                      }
                                    />
                                    <IconButton
                                      onClick={() =>
                                        openDeleteModal('patient', patient.name, provider.id, staff.id, patient.id)
                                      }
                                      disabled={isDeleting}
                                    >
                                      <Delete
                                        titleAccess="Delete Patient"
                                        style={{ color: '#f34343ff' }}
                                        fontSize="small"
                                      />
                                    </IconButton>
                                  </Stack>
                                </Box>
                              ))}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          {providers.length > 0 && (
            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={16} /> : null}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outlined" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
            </Stack>
          )}
        </Stack>
      )}

      <Dialog
        open={deleteModal.open}
        onClose={closeDeleteModal}
        aria-labelledby="delete-confirmation-dialog"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="delete-confirmation-dialog">Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deleteModal.type} "{deleteModal.name}"?
            {deleteModal.type === 'provider' && ' This will also delete all associated MAs and patients.'}
            {deleteModal.type === 'staff' && ' This will also delete all associated patients.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : null}
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </Button>
          <Button onClick={closeDeleteModal} color="primary" disabled={isDeleting}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={notificationModal.open}
        onClose={closeNotificationModal}
        aria-labelledby="notification-toggle-dialog"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="notification-toggle-dialog">
          Confirm {notificationModal.type === 'notification' ? 'Notification' : 'Report'} Toggle
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to turn {notificationModal.type}
            {notificationModal.currentValue ? ' OFF' : ' ON'}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmNotificationToggle} color="primary" variant="contained" autoFocus>
            Yes, {notificationModal.currentValue ? 'Turn Off' : 'Turn On'}
          </Button>
          <Button onClick={closeNotificationModal} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
