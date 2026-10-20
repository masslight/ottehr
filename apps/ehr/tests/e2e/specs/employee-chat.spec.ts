import { expect, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const PROCESS_ID = `employee-chat.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID);
const TIMEOUT = { timeout: 30000 };

test.describe('Employee chat', () => {
  test.skip(!FEATURE_FLAGS.EMPLOYEE_CHAT_ENABLED, 'Employee chat feature flag is off, skipping tests');

  test.beforeAll(async () => {
    await resourceHandler.setEmployees();
  });

  test.afterAll(async () => {
    await resourceHandler.deleteEmployees();
  });

  test('start a chat with an employee, send a link, and find it again after reload', async ({ page }) => {
    const employee = resourceHandler.testEmployee1;
    const employeeName = `${employee.givenName} ${employee.familyName}`;
    const body = `e2e ${PROCESS_ID} see https://example.com/${PROCESS_ID}`;

    await page.goto('/');
    const chatButton = page.locator('#employee-chat-button');
    await expect(chatButton).toBeVisible(TIMEOUT);
    await chatButton.click();

    const search = page.getByTestId('employee-chat-search');
    const unavailable = page.getByTestId('employee-chat-unavailable');
    await expect(unavailable.or(page.locator('[data-testid="employee-chat-search"]:enabled'))).toBeVisible(TIMEOUT);
    test.skip(
      await unavailable.isVisible(),
      'Oystehr Conversations is not configured for this environment (Oystehr error 4281), so chat cannot connect'
    );

    await search.fill(employee.familyName);
    await page.getByRole('option', { name: new RegExp(employeeName) }).click(TIMEOUT);
    await expect(page.getByRole('heading', { name: employeeName })).toBeVisible(TIMEOUT);

    const input = page.getByTestId('employee-chat-input');
    await input.fill(body);
    await input.press('Enter');

    const sent = page.getByTestId('employee-chat-message').filter({ hasText: PROCESS_ID });
    await expect(sent).toBeVisible(TIMEOUT);
    await expect(sent.getByRole('link', { name: `https://example.com/${PROCESS_ID}` })).toHaveAttribute(
      'href',
      `https://example.com/${PROCESS_ID}`
    );

    await page.reload();
    await expect(chatButton).toBeVisible(TIMEOUT);
    await chatButton.click();
    const listItem = page.getByTestId('employee-chat-list-item').filter({ hasText: employeeName });
    await expect(listItem).toBeVisible(TIMEOUT);
    await expect(listItem).toContainText(`You: ${body}`, TIMEOUT);

    await listItem.click();
    await expect(page.getByTestId('employee-chat-message').filter({ hasText: PROCESS_ID })).toBeVisible(TIMEOUT);
  });
});
