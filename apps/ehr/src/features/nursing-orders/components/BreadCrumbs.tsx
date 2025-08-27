import { FC } from 'react';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useAppointmentData } from 'src/telemed';

export const BreadCrumbs: FC = () => {
  const { appointment } = useAppointmentData();

  return (
    <CustomBreadcrumbs
      chain={[
        { link: `/in-person/${appointment?.id}/nursing-orders`, children: 'Orders' },
        { link: '#', children: 'Nursing Order' },
      ]}
    />
  );
};
