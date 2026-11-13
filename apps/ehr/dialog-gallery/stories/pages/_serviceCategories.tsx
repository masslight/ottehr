import { ReactElement, useState } from 'react';
import { AdminHeaderSlotProvider } from 'src/features/admin/AdminPageHeader';
import { ServiceCategoriesAdminPage } from 'src/pages/ServiceCategoriesAdminPage';
import type { FetchMock } from '../../harness/story';
import { zambdaOutput } from './_mocks';

export const serviceCategoriesMocks: FetchMock[] = [
  {
    url: 'list-service-categories',
    response: zambdaOutput({
      serviceCategories: [
        {
          id: 'sc-1',
          name: 'Sports Physical',
          code: 'sports-physical',
          abbreviation: 'SP',
          active: true,
          config: {
            durationMinutes: 30,
            cadenceMinutes: 15,
            serviceModes: ['in-person'],
            visitTypes: ['prebook', 'walk-in'],
            reasonsForVisit: [
              { label: 'School sports physical', value: 'School sports physical' },
              { label: 'Camp physical', value: 'Camp physical' },
            ],
          },
        },
      ],
    }),
  },
];

/**
 * The page lifts its "New Service" button into the shared admin header through a portal; in the app
 * the admin layout supplies that slot. This only gives the portal somewhere to land.
 */
export function ServiceCategoriesPageWithHeaderSlot(): ReactElement {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <AdminHeaderSlotProvider value={slot}>
      <div ref={setSlot} style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }} />
      <ServiceCategoriesAdminPage />
    </AdminHeaderSlotProvider>
  );
}
