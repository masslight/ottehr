import { FC } from 'react';
import { useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';

export const BreadCrumbs: FC = () => {
  const { id: appointmentIdFromUrl } = useParams();

  return (
    <CustomBreadcrumbs
      chain={[
        { link: `/in-person/${appointmentIdFromUrl}/nursing-orders`, children: 'Orders' },
        { link: '#', children: 'Nursing Order' },
      ]}
    />
  );
};
