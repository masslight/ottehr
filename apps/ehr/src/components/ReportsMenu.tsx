import { ArrowDropDown } from '@mui/icons-material';
import { Menu, MenuItem } from '@mui/material';
import { Bundle, FhirResource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { FOLLOWUP_SYSTEMS } from 'utils';
import { RoundedButton } from './RoundedButton';

export function ReportsMenu(): JSX.Element {
  const { oystehr } = useApiClients();
  const [anchorElement, setAnchorElement] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorElement);

  async function downloadReport(
    data: Bundle<FhirResource>,
    fileName: 'unsigned-charts' | 'appointments'
  ): Promise<void> {
    const element = document.createElement('a');
    setAnchorElement(null);
    element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data)));
    element.setAttribute('download', `${fileName}.json`);
    element.click();
  }

  async function getUnsignedCharts(): Promise<void> {
    if (!oystehr) {
      console.log('oystehr client is undefined');
      return;
    }
    const now = DateTime.now();
    const yesterday = now.minus({ days: 1 }).endOf('day');
    const ninetyDaysAgo = now.minus({ days: 90 }).startOf('day');
    const encounters = (await oystehr.fhir.search({
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
          value: 'Encounter:location',
        },
        {
          name: '_include',
          value: 'Encounter:participant',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:patient',
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
    })) as Bundle<FhirResource>;
    await downloadReport(encounters, 'unsigned-charts');
  }

  async function getAppointments(): Promise<void> {
    if (!oystehr) {
      console.log('oystehr client is undefined');
      return;
    }
    const now = DateTime.now();
    const yesterday = now.minus({ days: 1 }).endOf('day');
    const ninetyDaysAgo = now.minus({ days: 90 }).startOf('day');
    const encounters = (await oystehr.fhir.search({
      resourceType: 'Appointment',
      params: [
        {
          name: 'date',
          value: `le${yesterday}`,
        },
        {
          name: 'date',
          value: `ge${ninetyDaysAgo}`,
        },
        {
          name: 'date:missing',
          value: 'false',
        },
        {
          name: '_sort',
          value: 'date',
        },
        { name: '_count', value: '1000' },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Person:link',
        },
        {
          name: '_revinclude:iterate',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Encounter:participant',
        },
        {
          name: '_include',
          value: 'Appointment:location',
        },
        { name: '_revinclude:iterate', value: 'DocumentReference:patient' },
        { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
      ],
    })) as Bundle<FhirResource>;
    await downloadReport(encounters, 'appointments');
  }

  async function getEncounters(): Promise<void> {
    console.log('todo ');
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
        <MenuItem onClick={getAppointments}>Appointments</MenuItem>
        <MenuItem onClick={getEncounters}>Encounters</MenuItem>
      </Menu>
    </>
  );
}
