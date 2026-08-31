# Component Tests Migration

This directory contains component tests that have been migrated from E2E tests to improve test speed and reliability.

## Migrated Tests

### AddPatientValidation.test.tsx

Migrated from `tests/e2e/specs/addPatientPage.spec.ts`

These tests were originally E2E tests but were converted to component tests because they only test simple client-side validation logic that doesn't require a full browser environment or backend integration.

**Tests included:**

1. ✅ Cancel button navigates back to visits page
2. ✅ Shows validation error on mobile phone field when searching without entering a phone number  
3. ✅ Shows validation error on mobile phone field when searching with an invalid phone number
4. ✅ Shows validation error on date of birth field when entering an invalid date format
5. ✅ Shows error when clicking Add button without selecting a location
6. ✅ Shows error message when clicking Add button without searching for patient
7. ✅ Validates all required fields are present after patient search
8. ✅ Shows dialog when clicking Add for prebook visit without selecting a time slot
9. ✅ Shows dialog when clicking Add for post-telemed visit without selecting a time slot

**Benefits of migration:**

- **Speed**: Component tests run ~10-50x faster than E2E tests
- **Reliability**: No flakiness from network requests, browser timing, or backend state
- **Isolation**: Tests focus on component behavior without external dependencies
- **CI efficiency**: Faster feedback loop in continuous integration

## Running Component Tests

```bash
# Run all component tests
npm run component-tests

# Run a specific test file
npx vitest --config ./vitest.config.component-tests.ts tests/component/AddPatientValidation.test.tsx

# Run in watch mode
npx vitest --config ./vitest.config.component-tests.ts --watch
```

## Writing Component Tests

Component tests in this directory should:

- Focus on UI validation logic and user interactions
- Mock external dependencies (API clients, router, etc.)
- Use `@testing-library/react` for rendering and queries
- Use `@testing-library/user-event` for simulating user interactions
- Be fast and deterministic

## When to Use Component Tests vs E2E Tests

**Use Component Tests for:**

- Client-side validation logic
- UI state changes and interactions
- Form behavior without backend integration
- Error message display
- Navigation calls (mock router)

**Keep as E2E Tests for:**

- Full user workflows requiring backend integration
- Tests that verify data persistence
- Multi-page flows with real routing
- Tests that verify backend state changes
- Integration between multiple services
