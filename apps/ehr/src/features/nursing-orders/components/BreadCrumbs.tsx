import { FC } from 'react';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useAppointmentStore } from 'src/telemed';
import { getSelectors } from 'utils';

export const BreadCrumbs: FC = () => {
  const { appointment } = getSelectors(useAppointmentStore, ['appointment']);

  return (
    <CustomBreadcrumbs
      chain={[
        { link: `/in-person/${appointment?.id}/nursing-orders`, children: 'Orders' },
        { link: '#', children: 'Nursing Order' },
      ]}
    />
  );
};
