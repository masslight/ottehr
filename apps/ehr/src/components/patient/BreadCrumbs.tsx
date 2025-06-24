import { FC, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getFullName } from 'utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore } from '../../telemed';
import CustomBreadcrumbs from '../CustomBreadcrumbs';

export const BreadCrumbs: FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const appointmentId = queryParams.get('appointment') || undefined;

  const { patient } = getSelectors(useAppointmentStore, ['patient']);
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
