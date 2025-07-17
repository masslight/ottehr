import { FC } from 'react';
import { useAppointmentStore } from 'src/telemed';
import { getFullName, getSelectors } from 'utils';
import CustomBreadcrumbs from '../CustomBreadcrumbs';

export const BreadCrumbs: FC = () => {
  const { patient } = getSelectors(useAppointmentStore, ['patient']);

  return (
    <CustomBreadcrumbs
      chain={[
        { link: '/patients', children: 'Patients' },
        {
          link: `/patient/${patient?.id}`,
          children: patient ? getFullName(patient) : '',
        },
        {
          link: '#',
          children: 'Patient Information',
        },
      ]}
    />
  );
};
