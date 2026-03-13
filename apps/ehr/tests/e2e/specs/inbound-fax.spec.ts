import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const PROCESS_ID = `inbound-fax.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID);

let communicationId: string;

test.beforeAll(async () => {
  await resourceHandler.setResources({ skipPaperwork: true });

  // Create a fake inbound fax Communication + Task via the Oystehr client
  const oystehr = resourceHandler.oystehr;

  const senderFaxNumber = '+15559876543';

  // Create the Communication resource simulating an inbound fax
  const communication = await oystehr.fhir.create({
    resourceType: 'Communication',
    status: 'completed',
    medium: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
            code: 'FAXWRIT',
            display: 'telefax',
          },
        ],
      },
    ],
    sent: DateTime.utc().toISO()!,
    received: DateTime.utc().toISO()!,
    contained: [
      {
        resourceType: 'Device',
        id: 'sender-device',
        identifier: [{ value: senderFaxNumber }],
      },
    ],
    sender: { reference: '#sender-device' },
    payload: [
      {
        contentAttachment: {
          contentType: 'application/pdf',
          title: 'Test Fax',
          // Use a placeholder URL since we don't have real Z3 storage in E2E
          url: 'https://example.com/test-fax.pdf',
        },
      },
    ],
    extension: [
      {
        url: 'https://extensions.fhir.oystehr.com/fax-pages',
        valueInteger: 2,
      },
    ],
  });

  communicationId = communication.id!;

  // Create the Task that the subscription zambda would normally create
  await oystehr.fhir.create({
    resourceType: 'Task',
    status: 'ready',
    intent: 'order',
    meta: {
      tag: [
        {
          system: 'https://fhir.ottehr.com/Identifier/task-category',
          code: 'task',
        },
      ],
    },
    code: {
      coding: [
        {
          system: 'inbound-fax-task',
          code: 'match-inbound-fax',
        },
      ],
    },
    description: `Inbound fax from ${senderFaxNumber} (2 pages)`,
    basedOn: [{ reference: `Communication/${communicationId}` }],
    input: [
      {
        type: { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/task-input', code: 'sender-fax-number' }] },
        valueString: senderFaxNumber,
      },
      {
        type: { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/task-input', code: 'page-count' }] },
        valueString: '2',
      },
      {
        type: {
          coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/task-input', code: 'communication-id' }],
        },
        valueString: communicationId,
      },
      {
        type: { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/task-input', code: 'pdf-url' }] },
        valueString: 'https://example.com/test-fax.pdf',
      },
      {
        type: { coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/task-input', code: 'received-date' }] },
        valueString: DateTime.utc().toISO()!,
      },
    ],
  });
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.describe('Inbound Fax Match page', () => {
  test('loads the match page and displays fax metadata', async ({ page }) => {
    await page.goto(`/inbound-fax/${communicationId}/match`);

    // Page title should be visible
    await expect(page.getByText('Match Inbound Fax')).toBeVisible({ timeout: 15_000 });

    // Fax metadata should be displayed
    await expect(page.getByText(/\+15559876543/)).toBeVisible();
    await expect(page.getByText(/2 pages/)).toBeVisible();
  });

  test('shows patient search section', async ({ page }) => {
    await page.goto(`/inbound-fax/${communicationId}/match`);

    await expect(page.getByText('Match to patient:')).toBeVisible({ timeout: 15_000 });
  });

  test('Save button is disabled when no patient is selected', async ({ page }) => {
    await page.goto(`/inbound-fax/${communicationId}/match`);

    await expect(page.getByText('Match Inbound Fax')).toBeVisible({ timeout: 15_000 });

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();
  });

  test('Delete button is always available', async ({ page }) => {
    await page.goto(`/inbound-fax/${communicationId}/match`);

    await expect(page.getByText('Match Inbound Fax')).toBeVisible({ timeout: 15_000 });

    const deleteButton = page.getByRole('button', { name: 'Delete' });
    await expect(deleteButton).toBeEnabled();
  });

  test('shows error page when communication has no matching task', async ({ page }) => {
    // Navigate with a non-existent communication ID
    await page.goto('/inbound-fax/non-existent-comm-id/match');

    await expect(page.getByText('No matching task found for this fax')).toBeVisible({ timeout: 15_000 });
  });
});
