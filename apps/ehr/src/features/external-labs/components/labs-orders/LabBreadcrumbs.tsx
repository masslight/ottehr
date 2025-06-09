import { FC, useMemo } from 'react';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';

interface LabBreadcrumbsProps {
  sectionName: string;
  children: React.ReactNode;
}

export const LabBreadcrumbs: FC<LabBreadcrumbsProps> = ({ sectionName, children }) => {
  const { appointment } = getSelectors(useAppointmentStore, ['appointment']);

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
