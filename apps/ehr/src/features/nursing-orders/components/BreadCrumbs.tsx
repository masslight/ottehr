import { FC } from 'react';
import { useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useIsInlineFlow } from 'src/components/InlineFlow';

export const BreadCrumbs: FC = () => {
  const { id: appointmentIdFromUrl } = useParams();

  // Inline there is nowhere to navigate back to: the trail's base crumb is the very screen
  // the user is already on.
  if (useIsInlineFlow()) return null;

  return (
    <CustomBreadcrumbs
      chain={[
        { link: `/in-person/${appointmentIdFromUrl}/nursing-orders`, children: 'Orders' },
        { link: '#', children: 'Nursing Order' },
      ]}
    />
  );
};
