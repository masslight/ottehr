// Shared setup for the two PractitionerRoleList stories (not a story itself).
import { ReactElement } from 'react';
import PractitionerRoleList from 'src/components/schedule/PractitionerRoleList';
import { SCHEDULE_DISPLAY_NAME_EXTENSION_URL } from 'utils/lib/fhir/constants';
import type { FetchMock } from '../../harness/story';
import { bundleOf } from './_shared';

const location = { resourceType: 'Location', id: 'loc-1', status: 'active', name: 'Brooklyn Main Clinic' };
const role = {
  resourceType: 'PractitionerRole',
  id: 'role-1',
  active: true,
  practitioner: { reference: 'Practitioner/prac-1' },
  location: [{ reference: 'Location/loc-1' }],
  healthcareService: [{ reference: 'HealthcareService/hs-urgent' }, { reference: 'HealthcareService/hs-occ' }],
  extension: [{ url: SCHEDULE_DISPLAY_NAME_EXTENSION_URL, valueString: 'Weekday mornings' }],
};
const schedule = {
  resourceType: 'Schedule',
  id: 'sched-1',
  active: true,
  actor: [{ reference: 'PractitionerRole/role-1' }],
};

export const practitionerRoleListMocks: FetchMock[] = [
  { url: /\/fhir\/PractitionerRole/, response: bundleOf([role, location, schedule]) },
  { url: /\/fhir\/Location/, response: bundleOf([location]) },
  {
    url: 'service-categor',
    response: {
      status: 200,
      output: {
        serviceCategories: [
          { id: 'hs-urgent', code: 'urgent-care', name: 'Urgent Care', active: true },
          { id: 'hs-occ', code: 'occupational-medicine', name: 'Occupational Medicine', active: true },
        ],
      },
    },
  },
];

export const renderPractitionerRoleList = (): ReactElement => <PractitionerRoleList practitionerId="prac-1" />;
