import { FC, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BaseBreadcrumbs } from 'src/components/BaseBreadcrumbs';

interface LabBreadcrumbsProps {
  sectionName: string;
  children: React.ReactNode;
}

export const LabBreadcrumbs: FC<LabBreadcrumbsProps> = ({ sectionName, children }) => {
  const { id: appointmentIdFromUrl } = useParams();

  const baseCrumb = useMemo(
    () => ({
      label: 'External Labs',
      path: appointmentIdFromUrl ? `/in-person/${appointmentIdFromUrl}/external-lab-orders` : null,
    }),
    [appointmentIdFromUrl]
  );

  return (
    <BaseBreadcrumbs sectionName={sectionName} baseCrumb={baseCrumb}>
      {children}
    </BaseBreadcrumbs>
  );
};
