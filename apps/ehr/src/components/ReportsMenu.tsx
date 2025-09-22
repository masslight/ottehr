import { ArrowDropDown } from '@mui/icons-material';
import { Menu, MenuItem } from '@mui/material';
import { DateTime } from 'luxon';
import React from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { FOLLOWUP_SYSTEMS } from 'utils';
import { RoundedButton } from './RoundedButton';

export function ReportsMenu(): JSX.Element {
  const { oystehr } = useApiClients();
  const [anchorElement, setAnchorElement] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorElement);

  async function getUnsignedCharts(): Promise<void> {
    if (!oystehr) {
      console.log('oystehr client is undefined');
      return;
    }
    const now = DateTime.now();
    const yesterday = now.minus({ days: 1 }).endOf('day');
    const ninetyDaysAgo = now.minus({ days: 90 }).startOf('day');
    const encounters = await oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [
        {
          name: 'status',
          value: 'in-progress',
        },
        {
          name: 'type:not',
          value: `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}`,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Encounter:participant',
        },
        {
          name: 'appointment.date',
          value: `le${yesterday.toISODate()}`,
        },
        {
          name: 'appointment.date',
          value: `ge${ninetyDaysAgo.toISODate()}`,
        },
      ],
    });
    const element = document.createElement('a');
    setAnchorElement(null);
    element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(encounters)));
    element.setAttribute('download', 'unsigned-charts.json');
    element.click();
  }

  return (
    <>
      <RoundedButton
        id="reports-menu-button"
        variant="contained"
        onClick={(event) => setAnchorElement(event.currentTarget)}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        aria-controls={open ? 'reports-menu' : undefined}
        endIcon={<ArrowDropDown />}
      >
        Generate Report
      </RoundedButton>
      <Menu
        id="reports-menu"
        anchorEl={anchorElement}
        open={open}
        onClose={() => setAnchorElement(null)}
        MenuListProps={{ 'aria-labelledby': 'reports-menu-button' }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={getUnsignedCharts}>Unsigned charts</MenuItem>
      </Menu>
    </>
  );
}
