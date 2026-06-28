import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitType } from 'config-types';
import { ReactNode } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { BOOKING_CONFIG, getReasonForVisitOptionsForServiceCategory } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import AddPatient from '../../src/pages/AddPatient';

const TestProviders = ({ children }: { children: ReactNode }): JSX.Element => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const mockLocation = {
  resourceType: 'Location',
  id: 'test-location-1',
  name: 'Test Location',
  identifier: [
    {
      system: 'https://fhir.ottehr.com/r4/slug',
      value: 'test-location',
    },
  ],
};
const mockSchedule = {
  resourceType: 'Schedule',
  id: 'test-schedule-1',
  actor: [
    {
      reference: 'Location/test-location-1',
    },
  ],
};

// Mock the API client hooks to avoid authentication errors.
// IMPORTANT: the mocked clients are hoisted to module scope so the factory
// returns the same reference on every render. Returning a fresh object
// literal per call makes `useApiClients()` produce a new `oystehr` ref each
// render, which causes effects that depend on it (e.g. BookableSelect's
// load-bookable-targets effect) to refire on every render → infinite loop.
const mockOystehr = {
  fhir: {
    search: vi.fn().mockResolvedValue({
      entry: [
        {
          resource: mockLocation,
          search: {
            mode: 'match',
          },
        },
      ],
      total: 1,
      unbundle: () => [mockLocation, mockSchedule],
    }),
  },
};
const mockApiClients = {
  oystehr: mockOystehr,
  oystehrZambda: null,
};
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => mockApiClients,
}));

describe('AddVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const selectServiceCategory = async (
    user: ReturnType<typeof userEvent.setup>,
    screen: typeof import('@testing-library/react').screen,
    category?: string
  ): Promise<void> => {
    if (BOOKING_CONFIG.serviceCategories.length === 1) {
      // should be selected by default
      return;
    }
    const serviceCategoryDropdown = screen.getByTestId(dataTestIds.addPatientPage.serviceCategoryDropdown);
    const serviceCategoryButton = serviceCategoryDropdown.querySelector('[role="combobox"]');
    await user.click(serviceCategoryButton!);
    let serviceCategoryOption = BOOKING_CONFIG.serviceCategories[0].category.display;
    if (category) {
      const matchingOption = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === category);
      expect(matchingOption).toBeDefined();
      serviceCategoryOption = matchingOption!.category.display;
    }
    const generalOption = await screen.findByText(serviceCategoryOption);
    await user.click(generalOption);
  };

  it('Renders with appropriate fields', () => {
    render(
      <TestProviders>
        <AddPatient />
      </TestProviders>
    );

    const pageTitle = screen.getByTestId(dataTestIds.addPatientPage.pageTitle);
    expect(pageTitle).toBeVisible();
  });

  it('Cancel button navigates back to visits page', async () => {
    const user = userEvent.setup();
    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);

    render(
      <TestProviders>
        <AddPatient />
      </TestProviders>
    );

    const cancelButton = screen.getByTestId(dataTestIds.addPatientPage.cancelButton);
    expect(cancelButton).toBeVisible();

    await user.click(cancelButton);
    expect(navigateMock).toHaveBeenCalledWith('/visits');
  });

  it('Shows validation error on mobile phone field when searching without entering a phone number', async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AddPatient />
      </TestProviders>
    );

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

    const errorMessage = screen.getByText('Please enter at least one search term');
    expect(errorMessage).toBeVisible();
  });

  it('Searches for patients when pressing Enter in the patient search fields', async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AddPatient />
      </TestProviders>
    );

    const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');

    await user.click(phoneNumberInput!);
    await user.paste('1234567890');
    await user.keyboard('{Enter}');

    expect(await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton)).toBeVisible();
    expect(screen.queryByText('Please search for patients before adding')).not.toBeInTheDocument();
  });

  it('Shows validation error on mobile phone field when searching with an invalid phone number', async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AddPatient />
      </TestProviders>
    );

    const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');

    await user.click(phoneNumberInput!);
    await user.paste('123'); // Invalid number (less than 10 digits)

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

    const errorMessage = screen.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx');
    expect(errorMessage).toBeVisible();
  });

  it('Shows validation error on date of birth field when entering an invalid date format', async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AddPatient />
      </TestProviders>
    );

    // First, complete the phone search flow to reveal the date of birth field
    const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');

    await user.click(phoneNumberInput!);
    await user.paste('1234567890');
    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

    // Wait for the dialog to appear and then click the "Patient Not Found" button
    const notFoundButton = await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
    await user.click(notFoundButton);

    // Now test the date validation
    const dateOfBirthInput = await screen.findByPlaceholderText('MM/DD/YYYY');
    expect(dateOfBirthInput).toBeVisible();

    await user.click(dateOfBirthInput);
    await user.paste('3'); // Invalid date format
    await user.tab(); // Trigger validation by moving focus away

    const errorMessage = screen.getByText('please enter date in format MM/DD/YYYY');
    expect(errorMessage).toBeVisible();
  });

  describe('Required field validation', () => {
    const prebookOption = BOOKING_CONFIG.ehrBookingOptions.find((opt) => opt.id === VisitType.InPersonPreBook);
    const postTelemedOption = BOOKING_CONFIG.ehrBookingOptions.find((opt) => opt.id === VisitType.InPersonPostTelemed);

    it('Shows error when clicking Add button without selecting a location', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <AddPatient />
        </TestProviders>
      );

      const addButton = screen.getByTestId(dataTestIds.addPatientPage.addButton);
      await user.click(addButton);

      // HTML5 validation should prevent submission - form should still be visible
      expect(screen.getByTestId(dataTestIds.addPatientPage.pageTitle)).toBeInTheDocument();

      // Verify location input has required attribute
      const locationInput = screen.getByTestId(dataTestIds.addPatientPage.bookableSelect).querySelector('input');
      expect(locationInput).toHaveAttribute('required');
    });

    it('Shows error message when clicking Add button without searching for patient', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <AddPatient />
        </TestProviders>
      );

      // Enter phone number but don't search
      const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');
      await user.click(phoneNumberInput!);
      await user.paste('1234567890');

      const addButton = screen.getByTestId(dataTestIds.addPatientPage.addButton);
      await user.click(addButton);

      // Should show specific error about needing to search
      const errorMessage = screen.getByText('Please search for patients before adding');
      expect(errorMessage).toBeVisible();
    });

    it('Validates all required fields are present after patient search and service category selection', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <AddPatient />
        </TestProviders>
      );

      // Complete phone search flow
      const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');
      await user.click(phoneNumberInput!);
      await user.paste('1234567890');
      await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

      const notFoundButton = await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
      await user.click(notFoundButton);

      // Verify all required fields are present with required attribute
      const firstNameInput = screen.getByTestId(dataTestIds.addPatientPage.firstNameInput).querySelector('input');
      expect(firstNameInput).toHaveAttribute('required');

      const lastNameInput = screen.getByTestId(dataTestIds.addPatientPage.lastNameInput).querySelector('input');
      expect(lastNameInput).toHaveAttribute('required');

      const dateOfBirthInput = await screen.findByPlaceholderText('MM/DD/YYYY');
      expect(dateOfBirthInput).toHaveAttribute('required');

      const sexAtBirthInput = screen.getByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown).querySelector('input');
      expect(sexAtBirthInput).toHaveAttribute('required');

      // Select service category
      await selectServiceCategory(user, screen);

      const reasonForVisitInput = screen
        .getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown)
        .querySelector('input');
      expect(reasonForVisitInput).toHaveAttribute('required');

      const visitTypeInput = screen.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown).querySelector('input');
      expect(visitTypeInput).toHaveAttribute('required');
    });

    it.skipIf(!prebookOption)(
      'Shows dialog when clicking Add for prebook visit without selecting a time slot',
      async () => {
        const user = userEvent.setup();

        render(
          <TestProviders>
            <AddPatient />
          </TestProviders>
        );

        // Complete the form up to visit type selection
        const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');
        await user.click(phoneNumberInput!);
        await user.paste('1234567890');
        await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

        const notFoundButton = await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
        await user.click(notFoundButton);
        await waitForElementToBeRemoved(notFoundButton);

        // Fill required fields
        const firstNameInput = screen.getByTestId(dataTestIds.addPatientPage.firstNameInput).querySelector('input');
        await user.click(firstNameInput!);
        await user.paste('John');

        const lastNameInput = screen.getByTestId(dataTestIds.addPatientPage.lastNameInput).querySelector('input');
        await user.click(lastNameInput!);
        await user.paste('Doe');

        const dateOfBirthInput = await screen.findByPlaceholderText('MM/DD/YYYY');
        await user.click(dateOfBirthInput);
        await user.paste('01/01/2000');

        // Select sex at birth
        const sexAtBirthDropdown = screen.getByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown);
        const sexAtBirthButton = sexAtBirthDropdown.querySelector('[role="combobox"]');
        await user.click(sexAtBirthButton!);
        const maleOption = await screen.findByText('Male');
        await user.click(maleOption);

        // Select service category
        await selectServiceCategory(user, screen);

        // Select reason for visit
        const reasonDropdown = screen.getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown);
        const reasonButton = reasonDropdown.querySelector('[role="combobox"]');
        await user.click(reasonButton!);
        // Use the first available option
        const reasonOptions = await screen.findAllByRole('option');
        await user.click(reasonOptions[0]);

        // Select prebook visit type
        const visitTypeDropdown = screen.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown);
        const visitTypeButton = visitTypeDropdown.querySelector('[role="combobox"]');
        await user.click(visitTypeButton!);
        const prebookMenuOption = await screen.findByText(prebookOption!.label);
        await user.click(prebookMenuOption);

        // Select location
        const locationSelect = screen.getByTestId(dataTestIds.addPatientPage.bookableSelect);
        const locationInput = locationSelect.querySelector('input')!;
        await user.click(locationInput);
        const locationOption = await screen.findByText('Test Location');
        await user.click(locationOption);

        // Try to submit without selecting a slot
        const addButton = screen.getByTestId(dataTestIds.addPatientPage.addButton);
        await user.click(addButton);

        // Should show warning dialog
        const dialogMessage = await screen.findByText('To continue, please select an available appointment.');
        expect(dialogMessage).toBeVisible();
      },
      { timeout: 10000 }
    );

    it.skipIf(!postTelemedOption)(
      'Shows dialog when clicking Add for post-telemed visit without selecting a time slot',
      async () => {
        const user = userEvent.setup();

        render(
          <TestProviders>
            <AddPatient />
          </TestProviders>
        );

        // Complete the form up to visit type selection
        const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');
        await user.click(phoneNumberInput!);
        await user.paste('1234567890');
        await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

        const notFoundButton = await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
        await user.click(notFoundButton);
        await waitForElementToBeRemoved(notFoundButton);

        // Fill required fields
        const firstNameInput = screen.getByTestId(dataTestIds.addPatientPage.firstNameInput).querySelector('input');
        await user.click(firstNameInput!);
        await user.paste('John');

        const lastNameInput = screen.getByTestId(dataTestIds.addPatientPage.lastNameInput).querySelector('input');
        await user.click(lastNameInput!);
        await user.paste('Doe');

        const dateOfBirthInput = await screen.findByPlaceholderText('MM/DD/YYYY');
        await user.click(dateOfBirthInput);
        await user.paste('01/01/2000');

        // Select sex at birth
        const sexAtBirthDropdown = screen.getByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown);
        const sexAtBirthButton = sexAtBirthDropdown.querySelector('[role="combobox"]');
        await user.click(sexAtBirthButton!);
        const maleOption = await screen.findByText('Male');
        await user.click(maleOption);

        // Select service category
        await selectServiceCategory(user, screen);

        // Select reason for visit
        const reasonDropdown = screen.getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown);
        const reasonButton = reasonDropdown.querySelector('[role="combobox"]');
        await user.click(reasonButton!);
        const reasonOptions = await screen.findAllByRole('option');
        await user.click(reasonOptions[0]);

        // Select post-telemed visit type
        const visitTypeDropdown = screen.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown);
        const visitTypeButton = visitTypeDropdown.querySelector('[role="combobox"]');
        await user.click(visitTypeButton!);
        const postTelemedMenuOption = await screen.findByText(postTelemedOption!.label);
        await user.click(postTelemedMenuOption);

        // Select location
        const locationSelect = screen.getByTestId(dataTestIds.addPatientPage.bookableSelect);
        const locationInput = locationSelect.querySelector('input')!;
        await user.click(locationInput);
        const locationOption = await screen.findByText('Test Location');
        await user.click(locationOption);

        // Try to submit without selecting a slot
        const addButton = screen.getByTestId(dataTestIds.addPatientPage.addButton);
        await user.click(addButton);

        // Should show warning dialog
        const dialogMessage = await screen.findByText('To continue, please select an available appointment.');
        expect(dialogMessage).toBeVisible();
      },
      { timeout: 10000 }
    );
  });

  describe('Service category and reason for visit validation', () => {
    it('Should display correct reason for visit options for each service category', async () => {
      const user = userEvent.setup();

      render(
        <TestProviders>
          <AddPatient />
        </TestProviders>
      );

      // Complete phone search flow to reveal the form
      const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');
      await user.click(phoneNumberInput!);
      await user.paste('1234567890');
      await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

      const notFoundButton = await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
      await user.click(notFoundButton);
      await waitForElementToBeRemoved(notFoundButton);

      // Test each service category
      for (const serviceCategoryConfig of BOOKING_CONFIG.serviceCategories) {
        // Select the service category
        await selectServiceCategory(user, screen, serviceCategoryConfig.category.code);

        // Wait for reason for visit dropdown to appear
        const reasonDropdown = await screen.findByTestId(
          dataTestIds.addPatientPage.reasonForVisitDropdown,
          {},
          { timeout: 3000 }
        );

        // Open the reason for visit dropdown
        const reasonButton = reasonDropdown.querySelector('[role="combobox"]');
        await user.click(reasonButton!);

        // Get the expected options for this service category
        const expectedOptions = getReasonForVisitOptionsForServiceCategory(serviceCategoryConfig.category.code);
        expect(expectedOptions.length).toBeGreaterThan(0);

        // Get all visible options in the dropdown
        const optionElements = await screen.findAllByRole('option');

        // Filter to only reason for visit options (exclude any other dropdowns that might be open)
        const reasonOptions = optionElements.filter((option) => {
          const text = option.textContent;
          return expectedOptions.some((expected) => expected.label === text);
        });

        // Verify we have the correct number of reason for visit options
        expect(reasonOptions.length).toBe(expectedOptions.length);

        // Verify each expected option is present
        for (const expectedOption of expectedOptions) {
          const matchingOption = reasonOptions.find((option) => option.textContent === expectedOption.label);
          expect(matchingOption).toBeDefined();
        }

        // Close the dropdown by clicking elsewhere
        await user.keyboard('{Escape}');

        // Select a different service category for the next iteration (unless it's the last one)
        if (serviceCategoryConfig !== BOOKING_CONFIG.serviceCategories[BOOKING_CONFIG.serviceCategories.length - 1]) {
          const serviceCategoryDropdown = screen.getByTestId(dataTestIds.addPatientPage.serviceCategoryDropdown);
          const serviceCategoryButton = serviceCategoryDropdown.querySelector('[role="combobox"]');
          await user.click(serviceCategoryButton!);

          // Click to close the service category dropdown
          await user.keyboard('{Escape}');
        }
      }
    });
  });
});
