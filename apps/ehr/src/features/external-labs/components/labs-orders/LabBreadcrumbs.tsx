import { FC, useMemo } from 'react';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';
import { useAppointmentData } from '../../../../telemed';

interface LabBreadcrumbsProps {
  sectionName: string;
  children: React.ReactNode;
}

export const LabBreadcrumbs: FC<LabBreadcrumbsProps> = ({ sectionName, children }) => {
  const { appointment } = useAppointmentData();

  const baseCrumb = useMemo(
    () => ({
      label: 'External Labs',
      path: appointment?.id ? `/in-person/${appointment.id}/external-lab-orders` : null,
    }),
    [appointment?.id]
  );

  return (
    <BaseBreadcrumbs sectionName={sectionName} baseCrumb={baseCrumb}>
      {children}
    </BaseBreadcrumbs>
  );
};
