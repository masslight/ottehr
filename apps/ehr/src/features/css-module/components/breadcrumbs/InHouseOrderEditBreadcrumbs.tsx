import React from 'react';
import { useParams } from 'react-router-dom';
import { getInHouseMedicationMARUrl } from '../../routing/helpers';
import { BreadcrumbsView } from './BreadcrumbsView';

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
