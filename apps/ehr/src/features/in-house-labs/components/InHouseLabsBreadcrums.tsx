import { useMemo } from 'react';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { getInHouseLabsUrl } from 'src/features/css-module/routing/helpers';
import { useAppointmentStore } from 'src/telemed';

export const InHouseLabsBreadcrums: React.FC<{ children: React.ReactNode; pageName: string }> = ({
  children,
  pageName,
}) => {
  const appointmentId = useAppointmentStore((state) => state.appointment?.id);

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
