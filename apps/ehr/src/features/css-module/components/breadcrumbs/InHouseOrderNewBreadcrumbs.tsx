import React from 'react';
import { useParams } from 'react-router-dom';
import { BreadcrumbsView } from './BreadcrumbsView';
import { getInHouseMedicationMARUrl } from '../../routing/helpers';

export const InHouseOrderNewBreadcrumbs: React.FC = () => {
  const { id } = useParams();

  const breadcrumbItems = [
    {
      text: 'Medication',
      link: getInHouseMedicationMARUrl(id!),
    },
    {
      text: 'Order medication',
      link: '#',
      isActive: true,
    },
  ];

  return <BreadcrumbsView items={breadcrumbItems} />;
};
