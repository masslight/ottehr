import React from 'react';
import { useParams } from 'react-router-dom';
import { BreadcrumbsView } from './BreadcrumbsView';
import { getInHouseMedicationMARUrl } from '../../routing/helpers';

export const InHouseOrderEditBreadcrumbs: React.FC = () => {
  const { id: appointmentId } = useParams();

  const breadcrumbItems = [
    {
      text: 'Medication',
      link: getInHouseMedicationMARUrl(appointmentId!),
    },
    {
      text: `Edit Order`,
      link: '#',
      isActive: true,
    },
  ];

  return <BreadcrumbsView items={breadcrumbItems} />;
};
