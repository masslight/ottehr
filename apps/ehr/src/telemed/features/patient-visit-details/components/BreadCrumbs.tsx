import { FC, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getFullName } from 'utils';
import CustomBreadcrumbs from '../../../../components/CustomBreadcrumbs';
import { useAppointmentData } from '../../../state';

export const BreadCrumbs: FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const appointmentId = queryParams.get('appointment') || undefined;
  const { patient } = useAppointmentData();
  const fullName = useMemo(() => {
    if (patient) {
      return getFullName(patient);
    }
    return '';
  }, [patient]);

  return (
    <CustomBreadcrumbs
      chain={[
        { link: '/patients', children: 'Patients' },
        {
          link: `/patient/${patient?.id}`,
          children: fullName,
        },
        {
          link: '#',
          children: `Visit ID: ${appointmentId}`,
        },
      ]}
    />
  );
};
