import { useMemo } from 'react';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { getInHouseLabsUrl } from 'src/features/visits/in-person/routing/helpers';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';

export const InHouseLabsBreadcrumbs: React.FC<{ children: React.ReactNode; pageName: string }> = ({
  children,
  pageName,
}) => {
  const { appointment } = useAppointmentData();
  const appointmentId = appointment?.id;

  const baseCrumb = useMemo(() => {
    return {
      label: 'In-House Labs',
      path: appointmentId ? getInHouseLabsUrl(appointmentId) : null,
    };
  }, [appointmentId]);

  return (
    <BaseBreadcrumbs sectionName={pageName} baseCrumb={baseCrumb}>
      {children}
    </BaseBreadcrumbs>
  );
};
