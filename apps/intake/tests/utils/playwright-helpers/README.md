# Playwright Test Helpers

Reusable utility functions for Playwright E2E tests.

## Overview

This directory contains helper classes that encapsulate common UI interaction patterns, making tests more maintainable and reducing code duplication.

## Structure

- `interactions.ts` - Main helpers file containing interaction utilities organized by UI element type
- `index.ts` - Exports all helpers

## Available Helpers

### AutocompleteHelpers

Utilities for interacting with MUI Autocomplete components (dropdowns with search).

#### `selectFirstOption(page, selector)`
Selects the first available option from an Autocomplete dropdown. Works with virtualized lists and dynamically loaded options.

```typescript
import { AutocompleteHelpers } from '../playwright-helpers';

// Using test ID
await AutocompleteHelpers.selectFirstOption(page, 'location-selector');

// Using locator
const locationSelector = page.getByTestId('location-selector');
await AutocompleteHelpers.selectFirstOption(page, locationSelector);
```

**Use cases:**
- Selecting from dynamically loaded location lists
- Working with virtualized dropdowns where not all options are initially rendered
- Tests that don't depend on specific option values

#### `selectOptionByText(page, selector, optionText)`
Selects a specific option by its exact text content.

```typescript
await AutocompleteHelpers.selectOptionByText(page, 'location-selector', 'New York');
```

**Note:** May not work with virtualized lists if the option is not initially rendered.

#### `getVisibleOptions(page)`
Returns an array of all currently visible option texts in an opened dropdown.

```typescript
await input.click(); // Open dropdown first
const options = await AutocompleteHelpers.getVisibleOptions(page);
console.log(options); // ['Option 1', 'Option 2', ...]
```

### FormHelpers

Utilities for form interactions.

#### `fillInput(page, selector, value)`
Fills a text input field.

```typescript
await FormHelpers.fillInput(page, 'first-name-input', 'John');
```

#### `toggleCheckbox(page, selector, checked)`
Sets a checkbox to the desired state (checked/unchecked).

```typescript
await FormHelpers.toggleCheckbox(page, 'terms-checkbox', true);
```

### NavigationHelpers

Utilities for navigation and page transitions.

#### `clickAndContinue(page, buttonSelector, options?)`
Clicks a button and optionally waits for navigation or state change.

```typescript
await NavigationHelpers.clickAndContinue(page, 'continue-button');
await NavigationHelpers.clickAndContinue(page, 'submit-button', { timeout: 5000 });
```

#### `waitForPageLoad(page, pageIdentifier)`
Waits for a specific page or section to be loaded.

```typescript
await NavigationHelpers.waitForPageLoad(page, 'patient-info-page');
```

## Adding New Helpers

When adding new helpers:

1. Group them by UI element type or interaction pattern
2. Add class with descriptive name (e.g., `DatePickerHelpers`, `ModalHelpers`)
3. Make methods static for easy import and use
4. Add JSDoc comments explaining purpose and parameters
5. Include usage examples in this README

### Example:

```typescript
/**
 * Date picker helpers
 */
export class DatePickerHelpers {
  /**
   * Selects a date from an MUI DatePicker
   * @param page - Playwright page instance
   * @param selector - Test ID or locator for the date picker
   * @param date - Date to select (ISO format: YYYY-MM-DD)
   */
  static async selectDate(page: Page, selector: string | Locator, date: string): Promise<void> {
    // Implementation...
  }
}
```

## Best Practices

1. **Accept both string and Locator**: Helpers should accept both test IDs (string) and Locator objects for flexibility
2. **Wait for visibility**: Always ensure elements are visible before interacting
3. **Provide clear error messages**: Throw descriptive errors when operations fail
4. **Document edge cases**: Note limitations (e.g., virtualization issues)
5. **Keep helpers focused**: Each helper should do one thing well

## FileUploadHelpers

Simple utilities for file upload operations.

### uploadFile

Clicks upload button and uploads a file.

```typescript
import { FileUploadHelpers } from './playwright-helpers';

await FileUploadHelpers.uploadFile(page, '#photo-id-front', '/absolute/path/to/file.jpg');

// Also supports attribute selectors for complex ids
await FileUploadHelpers.uploadFile(page, '[id="secondary-insurance.item.14"]', '/absolute/path/to/file.jpg');
```

### reuploadFile

Clicks "Click to re-upload" link and uploads a file (when file was already uploaded).

```typescript
await FileUploadHelpers.reuploadFile(page, '#photo-id-front', '/absolute/path/to/file.jpg');

// Also supports attribute selectors for complex ids
await FileUploadHelpers.reuploadFile(page, '[id="secondary-insurance.item.14"]', '/absolute/path/to/file.jpg');
```

**Selector formats supported**:
- Simple id: `#photo-id-front` → extracts `photo-id-front`
- Attribute selector: `[id="secondary-insurance.item.14"]` → extracts `secondary-insurance.item.14`

**When to use**: 
- `uploadFile` - when uploading a new file
- `reuploadFile` - when file is already uploaded and you see "Click to re-upload" link

**Note**: Tests should check if file is already uploaded before calling these helpers.

## Migration Notes

When refactoring existing tests to use these helpers:

- Look for repeated patterns in test files
- Extract to appropriate helper class
- Update all usages across test suite
- Remove redundant code from individual test files
