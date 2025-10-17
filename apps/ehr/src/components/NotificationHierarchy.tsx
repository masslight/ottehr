import { Add, Remove } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Option {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  name: string;
  patients: Patient[];
}

interface Provider {
  id: string;
  name: string;
  staff: Staff[];
}

export const NotificationHierarchy = (): JSX.Element => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [providerOptions, setProviderOptions] = useState<Option[]>([]);
  const [staffOptions, setStaffOptions] = useState<Record<string, Option[]>>({});
  const [patientOptions, setPatientOptions] = useState<Record<string, Option[]>>({});

  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState<Record<string, boolean>>({});
  const [showPatientDropdown, setShowPatientDropdown] = useState<Record<string, boolean>>({});

  const mockData = useMemo(
    () => ({
      Provider: [
        { id: 'prov1', name: 'Provider 1' },
        { id: 'prov2', name: 'Provider 2' },
        { id: 'prov3', name: 'Provider 3' },
      ],
      Staff: [
        { id: 'staff1', name: 'Staff 1' },
        { id: 'staff2', name: 'Staff 2' },
        { id: 'staff3', name: 'Staff 3' },
      ],
      Patient: [
        { id: 'pat1', name: 'Patient 1' },
        { id: 'pat2', name: 'Patient 2' },
        { id: 'pat3', name: 'Patient 3' },
        { id: 'pat4', name: 'Patient 4' },
      ],
    }),
    []
  );

  const fetchData = useCallback(
    async (resourceType: string): Promise<Option[]> => {
      setLoading(true);
      return new Promise((resolve) => {
        setTimeout(() => {
          setLoading(false);
          resolve(mockData[resourceType as keyof typeof mockData] || []);
        }, 500);
      });
    },
    [mockData]
  );

  const fetchProviderData = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchData('Provider');
      setProviderOptions(data);
    } catch (error) {
      console.error('Failed to fetch provider data:', error);
    }
  }, [fetchData]);

  useEffect(() => {
    void fetchProviderData();
  }, [fetchProviderData]);

  const handleProviderSelect = async (providerId: string): Promise<void> => {
    const selectedProvider = providerOptions.find((p) => p.id === providerId);
    if (!selectedProvider) return;

    setProviders((prev) => [...prev, { id: selectedProvider.id, name: selectedProvider.name, staff: [] }]);

    const staffData = await fetchData('Staff');
    setStaffOptions((prev) => ({ ...prev, [providerId]: staffData }));

    setShowProviderDropdown(false);
  };

  const handleStaffSelect = async (providerId: string, staffId: string): Promise<void> => {
    const selectedStaff = staffOptions[providerId]?.find((s) => s.id === staffId);
    if (!selectedStaff) return;

    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, staff: [...p.staff, { id: staffId, name: selectedStaff.name, patients: [] }] } : p
      )
    );

    const patientData = await fetchData('Patient');
    setPatientOptions((prev) => ({ ...prev, [staffId]: patientData }));

    setShowStaffDropdown((prev) => ({ ...prev, [providerId]: false }));
  };

  const handlePatientSelect = (providerId: string, staffId: string, patientId: string): void => {
    const selectedPatient = patientOptions[staffId]?.find((p) => p.id === patientId);
    if (!selectedPatient) return;

    setProviders((prev) =>
      prev.map((prov) =>
        prov.id === providerId
          ? {
              ...prov,
              staff: prov.staff.map((st) =>
                st.id === staffId
                  ? {
                      ...st,
                      patients: [...st.patients, { id: patientId, name: selectedPatient.name }],
                    }
                  : st
              ),
            }
          : prov
      )
    );

    setShowPatientDropdown((prev) => ({ ...prev, [staffId]: false }));
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
    console.log('Saving selected data:', providers);

    console.log('Providers data to be saved:', JSON.stringify(providers, null, 2));
  };

  const handleCancel = (): void => {
    console.log('Canceling changes');
    setProviders([]);
    setShowProviderDropdown(false);
    setShowStaffDropdown({});
    setShowPatientDropdown({});
  };

  return (
    <>
      <Typography variant="h4" color="primary.dark">
        Notification Settings
      </Typography>
      <Box display="flex" alignItems="center" mt={2} mb={3} gap={1}>
        <Typography variant="body2">Notifications</Typography>
        <Switch size="small" />
      </Box>
      <Stack spacing={3} mt={3}>
        {/* Add Provider Button */}
        {!showProviderDropdown && (
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setShowProviderDropdown(true)}
            sx={{ width: 'fit-content' }}
          >
            Add Provider
          </Button>
        )}

        {/* Provider Dropdown */}
        {showProviderDropdown && (
          <FormControl size="small" sx={{ width: 300 }}>
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <Select displayEmpty defaultValue="" onChange={(e) => handleProviderSelect(e.target.value)}>
                <MenuItem value="" disabled>
                  Select Provider
                </MenuItem>
                {providerOptions.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </FormControl>
        )}

        {/* Provider hierarchy */}
        {providers.map((provider) => (
          <Card key={provider.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              {/* Provider Header */}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">{provider.name}</Typography>
                <IconButton onClick={() => removeProvider(provider.id)}>
                  <Remove fontSize="small" />
                </IconButton>
              </Stack>

              {/* Add Staff Button */}
              {!showStaffDropdown[provider.id] && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setShowStaffDropdown((prev) => ({ ...prev, [provider.id]: true }))}
                  sx={{ mt: 2, width: 'fit-content' }}
                >
                  Add Staff
                </Button>
              )}

              {/* Staff Dropdown */}
              {showStaffDropdown[provider.id] && (
                <FormControl size="small" sx={{ width: 300, mt: 2 }}>
                  {loading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Select
                      displayEmpty
                      defaultValue=""
                      onChange={(e) => handleStaffSelect(provider.id, e.target.value)}
                    >
                      <MenuItem value="" disabled>
                        Select Staff
                      </MenuItem>
                      {staffOptions[provider.id]?.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </FormControl>
              )}

              {/* Staff Hierarchy */}
              <Stack spacing={2} mt={2}>
                {provider.staff.map((staff) => (
                  <Card key={staff.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle1">{staff.name}</Typography>
                        <IconButton onClick={() => removeStaff(provider.id, staff.id)}>
                          <Remove fontSize="small" />
                        </IconButton>
                      </Stack>

                      {/* Add Patient Button */}
                      {!showPatientDropdown[staff.id] && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Add />}
                          onClick={() => setShowPatientDropdown((prev) => ({ ...prev, [staff.id]: true }))}
                          sx={{ mt: 2, width: 'fit-content' }}
                        >
                          Add Patient
                        </Button>
                      )}

                      {/* Patient Dropdown */}
                      {showPatientDropdown[staff.id] && (
                        <FormControl size="small" sx={{ width: 300, mt: 2 }}>
                          {loading ? (
                            <CircularProgress size={20} />
                          ) : (
                            <Select
                              displayEmpty
                              defaultValue=""
                              onChange={(e) => handlePatientSelect(provider.id, staff.id, e.target.value)}
                            >
                              <MenuItem value="" disabled>
                                Select Patient
                              </MenuItem>
                              {patientOptions[staff.id]?.map((pt) => (
                                <MenuItem key={pt.id} value={pt.id}>
                                  {pt.name}
                                </MenuItem>
                              ))}
                            </Select>
                          )}
                        </FormControl>
                      )}

                      {/* Patients List */}
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
                            <Typography>{patient.name}</Typography>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2">Report</Typography>
                              <Switch size="small" />
                              <Typography variant="body2">Notification</Typography>
                              <Switch size="small" />
                              <IconButton onClick={() => removePatient(provider.id, staff.id, patient.id)}>
                                <Remove fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}

        {/* Save and Cancel Buttons */}
        {providers.length > 0 && (
          <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
          </Stack>
        )}
      </Stack>
    </>
  );
};
