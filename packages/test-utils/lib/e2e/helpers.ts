import { expect, Locator, Page } from '@playwright/test';

export async function checkString(locator: Locator, string: string): Promise<void> {
  await expect(locator).toHaveText(string);
}

export async function checkPageHasText(pageTest: Page, text: string): Promise<void> {
  const page = pageTest.locator('.MuiContainer-maxWidthMd');
  console.log(page.innerHTML, await page.innerHTML());
  await expect(page).toContainText(text);
}

export async function checkInputsRequiredProperty(pageTest: Page, names: string[], required: boolean): Promise<void> {
  for (const name of names) {
    const element = pageTest.locator(`[name=${name}]`);
    if (required) {
      await expect(element).toHaveAttribute('required');
    } else {
      await expect(element).not.toHaveAttribute('required');
    }
  }
}

export async function checkPageTitleAndSubtitle(pageTest: Page, title: string, subtitle: string): Promise<void> {
  const titleElement = pageTest.getByRole('heading', { name: title, level: 1, exact: true });
  await expect(titleElement).toHaveText(title);
  const subtitleElement = pageTest.getByRole('heading', { name: subtitle, level: 2, exact: true });
  await expect(subtitleElement).toHaveText(subtitle);
}

export async function setFieldWithName(pageTest: Page, name: string, value: string): Promise<void> {
  const element = pageTest.locator(`[name="${name}"]`);
  await element.fill(value);
}

export async function chooseFirstItemInSelect(pageTest: Page, name: string): Promise<void> {
  const element = pageTest.locator(`#${name}`);
  await element.click();
  const selectList = pageTest.locator('.MuiList-root');
  await selectList.click();
}

export async function checkItemsInAutocomplete(pageTest: Page, name: string, items: string[]): Promise<void> {
  const autocomplete = pageTest.locator('.MuiAutocomplete-root');
  await expect(autocomplete).toHaveCount(1);
  await autocomplete.click();
  for (const item of items) {
    await pageTest.keyboard.press('ArrowDown');
    await expect(pageTest.locator(`#${name}`)).toHaveValue(item);
  }
}

export async function checkItemsInSelect(pageTest: Page, name: string, options: string[]): Promise<void> {
  const select = pageTest.locator(`[name="${name}"]`);
  await expect(select).toHaveCount(1);
  await expect(pageTest.locator('.MuiMenuItem-root')).toHaveCount(options.length);
  for (const option of options) {
    await pageTest.keyboard.press('Enter');
    await checkString(pageTest.locator('.Mui-selected'), option);
    await pageTest.keyboard.press('Space');
    await pageTest.keyboard.press('ArrowDown');
  }
  expect(await pageTest.locator('.Mui-selected').textContent()).toBe(options[options.length - 1]);
  // await pageTest.keyboard.press('Enter');
}

export async function checkErrorDialog(
  pageTest: Page,
  title: string,
  description: string,
  // todo test closing modal with x button
  closeMethod: 'key' | 'button'
): Promise<void> {
  const dialog = pageTest.locator('.MuiDialog-container');
  await expect(dialog).toHaveCount(1);
  const titleElement = pageTest.getByRole('heading', { name: title });
  const subtitleElement = pageTest.getByText(description);
  await expect(titleElement).toHaveText(title);
  await expect(subtitleElement).toHaveText(description);
  const closeButton = pageTest.locator('.MuiDialog-container .MuiButton-sizeLarge').filter({ hasText: 'Close' });
  await expect(closeButton).toHaveText('Close');
  if (closeMethod === 'key') {
    await pageTest.keyboard.press('Escape');
  } else {
    await closeButton.click();
  }
  await expect(dialog).toHaveCount(0);
}

export async function checkTable(pageTest: Page, rows: string[][]): Promise<void> {
  const tableRows = pageTest.locator('tr');
  await expect(tableRows).toHaveCount(rows.length);

  for (let i = 0; i < rows.length; i++) {
    // don't include strings that are only space
    const rowTemp = tableRows.nth(i).locator('td').filter({ hasText: /\S/ });
    expect(await rowTemp.count()).toBe(rows[i].length);
    for (let j = 0; j < rows[i].length; j++) {
      const cellTemp = rowTemp.nth(j);
      console.log(j, await cellTemp.textContent());
      await expect(cellTemp).toHaveText(rows[i][j]);
    }
  }
}

export async function checkPageBackButton(page: Page, defined: boolean): Promise<void> {
  const backButton = page.getByRole('button', { name: 'Back' });
  await expect(backButton).toHaveCount(defined ? 1 : 0);
}

export async function checkFieldHasError(
  pageTest: Page,
  name: string,
  error: string,
  inputType: 'text' | 'radio'
): Promise<void> {
  await expect(pageTest.locator(`#${name}-helper-text`)).toHaveText(error);
  expect(
    (await pageTest.locator(inputType === 'text' ? `[for=${name}]` : `#${name}-label`).getAttribute('class'))?.split(
      ' '
    )
  ).toContain('Mui-error');
  // const reasonForVisit = pageTest.locator('[for="reasonForVisit"]');
  // check if reasonForVisit has Mui-error class
  // expect((await reasonForVisit.getAttribute('class'))?.split(' ')).toContain('Mui-error');
}

export async function nextPage(pageTest: Page, button = 'Continue'): Promise<void> {
  const nextButton = pageTest.getByRole('button', { name: button });
  await nextButton.click();
}

export async function iterateThroughTable(
  tableLocator: Locator,
  callback: (row: Locator) => Promise<void>
): Promise<void> {
  const rows = tableLocator.locator('tbody tr');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    await callback(rows.nth(i));
  }
}

export async function fillWaitAndSelectDropdown(
  page: Page,
  dropdownDataTestId: string,
  textToFill: string
): Promise<void> {
  await page.getByTestId(dropdownDataTestId).locator('input').fill(textToFill);
  // Wait for dropdown options to appear
  const dropdownOptions = page.locator('.MuiAutocomplete-popper li'); // MUI uses this class for dropdown items
  await dropdownOptions.first().waitFor(); // Wait for the first option to become visible
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}
