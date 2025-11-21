import { Patient } from 'fhir/r4b';
import { FC } from 'react';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { getFullName } from 'utils';

export const BreadCrumbs: FC<{ patient: Patient | undefined }> = ({ patient }) => (
  <CustomBreadcrumbs
    chain={[
      { link: '/patients', children: 'Patients' },
      {
        link: `/patient/${patient?.id}`,
        children: patient ? getFullName(patient) : '',
      },
      {
        link: '#',
        children: 'Patient Profile',
      },
    ]}
  />
);
