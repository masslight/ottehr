import { test } from '@playwright/test';
import { AppointmentParticipant, Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isTelemedEnabled } from 'test-utils';
import { openVisitsPage } from 'tests/e2e/page/VisitsPage';
import { isLocationVirtual } from 'utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

test.describe.configure({ mode: 'serial' });

// Skip telemed tests if virtual locations are not configured
test.skip(!isTelemedEnabled, 'Telemed tests require virtual locations to be configured');

test.describe('Telemed appointment with two locations (physical and virtual)', () => {
  const PROCESS_ID = `telemedEhrFlow.spec.ts-2-locs-no-appointment-state-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let location: Location;
  test.beforeAll(async () => {
    location = await createAppointmentWithVirtualAndPhysicalLocations(resourceHandler);
  });
  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });
  test('Appointment is present in tracking board and searchable by location filter', async ({ page }) => {
    const visitsPage = await openVisitsPage(page);
    await visitsPage.selectLocation(location.name ?? 'Unknown');
    await visitsPage.verifyVisitPresent(resourceHandler.appointment.id!);
  });
});

async function createAppointmentWithVirtualAndPhysicalLocations(resourceHandler: ResourceHandler): Promise<Location> {
  const oystehr = await ResourceHandler.getOystehr();
  const [physicalLocation] = await Promise.all([
    new Promise<Location>((resolve, reject) => {
      oystehr.fhir
        .search({
          resourceType: 'Location',
          params: [
            {
              name: '_count',
              value: '1000',
            },
          ],
        })
        .then((locations) => {
          const nonVirtualLocation = locations
            .unbundle()
            .filter((location) => location.resourceType === 'Location')
            .find((location) => {
              const loc = location as Location;
              // Find a non-virtual location that has a valid name (not undefined)
              const hasValidName = loc.name && loc.name !== 'undefined';
              return !isLocationVirtual(loc) && hasValidName;
            });
          if (!nonVirtualLocation) {
            throw new Error('No non-virtual location with valid name found');
          }
          resolve(nonVirtualLocation as Location);
        })
        .catch((error) => {
          reject(error);
        });
    }),
    await resourceHandler.setResources({ skipPaperwork: true }),
  ]);

  await oystehr.fhir.patch({
    resourceType: 'Appointment',
    id: resourceHandler.appointment.id!,
    operations: [
      {
        op: 'add',
        path: '/participant/-',
        value: <AppointmentParticipant>{
          actor: {
            reference: `Location/${physicalLocation.id}`,
          },
          status: 'accepted',
        },
      },
    ],
  });

  await new Promise((resolve) => setTimeout(resolve, 1_000));

  return physicalLocation;
}
