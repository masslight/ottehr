import {
  Box,
  Checkbox,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement, useMemo } from 'react';
import {
  NotificationRowPref,
  ProviderNotificationMethod,
  ProviderNotificationPreferencesV2,
  UI_TASK_CATEGORY_IDS,
  UI_TASK_CATEGORY_LABELS,
  UiTaskCategoryId,
} from 'utils';

const ALL_LOCATIONS_OPTION = '__all__';

interface NotificationSettingsTableProps {
  preferences: ProviderNotificationPreferencesV2;
  onChange: (next: ProviderNotificationPreferencesV2) => void;
  locations: { id: string; name: string }[];
  disabled?: boolean;
}

const TOP_LEVEL_ROWS: { key: 'virtualVisitScheduled' | 'waitingRoom'; label: string }[] = [
  { key: 'virtualVisitScheduled', label: 'Patient schedules virtual visit' },
  { key: 'waitingRoom', label: 'Patient is ready for their visit in the virtual waiting room' },
];

export default function NotificationSettingsTable({
  preferences,
  onChange,
  locations,
  disabled,
}: NotificationSettingsTableProps): ReactElement {
  const locationNameById = useMemo(() => new Map(locations.map((loc) => [loc.id, loc.name])), [locations]);

  const allTaskRows = UI_TASK_CATEGORY_IDS.map((id) => preferences.taskCategories[id]);
  const allTasksEnabled = allTaskRows.every((row) => row.enabled);
  const someTasksEnabled = allTaskRows.some((row) => row.enabled);

  const everyRow = [preferences.virtualVisitScheduled, preferences.waitingRoom, ...allTaskRows];
  const allEnabled = everyRow.every((row) => row.enabled);
  const someEnabled = everyRow.some((row) => row.enabled);

  const setTopRow = (key: (typeof TOP_LEVEL_ROWS)[number]['key'], row: NotificationRowPref): void => {
    onChange({ ...preferences, [key]: row });
  };

  const setTaskRow = (id: UiTaskCategoryId, row: NotificationRowPref): void => {
    onChange({ ...preferences, taskCategories: { ...preferences.taskCategories, [id]: row } });
  };

  const withAllTaskCategoriesEnabled = (enabled: boolean): ProviderNotificationPreferencesV2['taskCategories'] => {
    const taskCategories = { ...preferences.taskCategories };
    for (const id of UI_TASK_CATEGORY_IDS) {
      taskCategories[id] = { ...taskCategories[id], enabled };
    }
    return taskCategories;
  };

  const setAllTasksEnabled = (enabled: boolean): void => {
    onChange({ ...preferences, taskCategories: withAllTaskCategoriesEnabled(enabled) });
  };

  const setAllEnabled = (enabled: boolean): void => {
    onChange({
      ...preferences,
      virtualVisitScheduled: { ...preferences.virtualVisitScheduled, enabled },
      waitingRoom: { ...preferences.waitingRoom, enabled },
      taskCategories: withAllTaskCategoriesEnabled(enabled),
    });
  };

  return (
    <Table size="small" sx={{ tableLayout: 'fixed' }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: '34%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={allEnabled}
                disabled={disabled}
                onChange={(e) => setAllEnabled(e.target.checked)}
                sx={{ opacity: !allEnabled && someEnabled ? 0.6 : 1 }}
              />
              <Typography sx={{ fontWeight: 600 }}>Notification type</Typography>
            </Box>
          </TableCell>
          <TableCell sx={{ width: '16%', fontWeight: 600 }}>Notify me by</TableCell>
          <TableCell sx={{ width: '34%', fontWeight: 600 }}>Locations</TableCell>
          <TableCell sx={{ width: '16%', fontWeight: 600 }}>Assigned to</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {TOP_LEVEL_ROWS.map(({ key, label }) => (
          <NotificationRow
            key={key}
            label={label}
            row={preferences[key]}
            disabled={disabled}
            locations={locations}
            locationNameById={locationNameById}
            onChange={(row) => setTopRow(key, row)}
          />
        ))}

        <TableRow>
          <TableCell colSpan={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={allTasksEnabled}
                disabled={disabled}
                onChange={(e) => setAllTasksEnabled(e.target.checked)}
                sx={{ opacity: !allTasksEnabled && someTasksEnabled ? 0.6 : 1 }}
              />
              <Typography sx={{ fontWeight: 600 }}>All tasks notifications</Typography>
            </Box>
          </TableCell>
        </TableRow>

        {UI_TASK_CATEGORY_IDS.map((id) => (
          <NotificationRow
            key={id}
            label={UI_TASK_CATEGORY_LABELS[id]}
            indent
            row={preferences.taskCategories[id]}
            disabled={disabled}
            locations={locations}
            locationNameById={locationNameById}
            onChange={(row) => setTaskRow(id, row)}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface NotificationRowProps {
  label: string;
  row: NotificationRowPref;
  onChange: (row: NotificationRowPref) => void;
  locations: { id: string; name: string }[];
  locationNameById: Map<string, string>;
  disabled?: boolean;
  indent?: boolean;
}

function NotificationRow({
  label,
  row,
  onChange,
  locations,
  locationNameById,
  disabled,
  indent,
}: NotificationRowProps): ReactElement {
  const controlsDisabled = disabled || !row.enabled;

  const selectedLocationValues = row.allLocations ? [ALL_LOCATIONS_OPTION] : row.locationIds;

  const handleLocationChange = (value: string[]): void => {
    const hasAll = value.includes(ALL_LOCATIONS_OPTION);
    if (hasAll && !row.allLocations) {
      onChange({ ...row, allLocations: true, locationIds: [] });
      return;
    }
    const specificIds = value.filter((v) => v !== ALL_LOCATIONS_OPTION);
    // Deselecting the last location would leave an enabled row that matches nothing; fall back to "All".
    if (specificIds.length === 0) {
      onChange({ ...row, allLocations: true, locationIds: [] });
      return;
    }
    onChange({ ...row, allLocations: false, locationIds: specificIds });
  };

  return (
    <TableRow>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: indent ? 4 : 0 }}>
          <Switch
            checked={row.enabled}
            disabled={disabled}
            onChange={(e) => onChange({ ...row, enabled: e.target.checked })}
          />
          <Typography>{label}</Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Select
          size="small"
          fullWidth
          value={row.method}
          disabled={controlsDisabled}
          onChange={(e) => onChange({ ...row, method: e.target.value as ProviderNotificationMethod })}
        >
          {Object.values(ProviderNotificationMethod).map((method) => (
            <MenuItem key={method} value={method}>
              {method}
            </MenuItem>
          ))}
        </Select>
      </TableCell>
      <TableCell>
        <Select
          size="small"
          fullWidth
          multiple
          displayEmpty
          value={selectedLocationValues}
          disabled={controlsDisabled}
          sx={{ '& .MuiSelect-select': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }}
          onChange={(e) => handleLocationChange(e.target.value as string[])}
          renderValue={() =>
            row.allLocations
              ? 'All locations'
              : row.locationIds.length > 0
              ? row.locationIds.map((id) => locationNameById.get(id) ?? id).join(', ')
              : 'Select locations'
          }
        >
          <MenuItem value={ALL_LOCATIONS_OPTION}>
            <Checkbox checked={row.allLocations} />
            All locations
          </MenuItem>
          {locations.map((loc) => (
            <MenuItem key={loc.id} value={loc.id}>
              <Checkbox checked={!row.allLocations && row.locationIds.includes(loc.id)} />
              {loc.name}
            </MenuItem>
          ))}
        </Select>
      </TableCell>
      <TableCell>
        <Select
          size="small"
          fullWidth
          value={row.assignedTo}
          disabled={controlsDisabled}
          onChange={(e) => onChange({ ...row, assignedTo: e.target.value as NotificationRowPref['assignedTo'] })}
        >
          <MenuItem value="me">Only Me</MenuItem>
          <MenuItem value="anyone">Anyone</MenuItem>
        </Select>
      </TableCell>
    </TableRow>
  );
}
