import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import AddPatient from '../../src/pages/AddPatient';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock the API client hooks to avoid authentication errors
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: {
      fhir: {
        search: vi.fn().mockResolvedValue({
          unbundle: () => [],
        }),
      },
    },
    oystehrZambda: null,
  }),
}));

describe('AddPatient - Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Cancel button navigates back to visits page', async () => {
    const user = userEvent.setup();
    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    const cancelButton = screen.getByTestId(dataTestIds.addPatientPage.cancelButton);
    expect(cancelButton).toBeVisible();

    await user.click(cancelButton);
    expect(navigateMock).toHaveBeenCalledWith('/visits');
  });

  it('Shows validation error on mobile phone field when searching without entering a phone number', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

    const errorMessage = screen.getByText('Please enter at least one search term');
    expect(errorMessage).toBeVisible();
  });

  it('Shows validation error on mobile phone field when searching with an invalid phone number', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
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
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
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
    it('Shows error when clicking Add button without selecting a location', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <AddPatient />
        </BrowserRouter>
      );

      const addButton = screen.getByTestId(dataTestIds.addPatientPage.addButton);
      await user.click(addButton);

      // HTML5 validation should prevent submission - form should still be visible
      expect(screen.getByTestId(dataTestIds.addPatientPage.pageTitle)).toBeInTheDocument();

      // Verify location input has required attribute
      const locationInput = screen.getByTestId(dataTestIds.dashboard.locationSelect).querySelector('input');
      expect(locationInput).toHaveAttribute('required');
    });

    it('Shows error message when clicking Add button without searching for patient', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <AddPatient />
        </BrowserRouter>
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

    it('Validates all required fields are present after patient search', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <AddPatient />
        </BrowserRouter>
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

      const reasonForVisitInput = screen
        .getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown)
        .querySelector('input');
      expect(reasonForVisitInput).toHaveAttribute('required');

      const visitTypeInput = screen.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown).querySelector('input');
      expect(visitTypeInput).toHaveAttribute('required');
    });

    it(
      'Shows dialog when clicking Add for prebook visit without selecting a time slot',
      async () => {
        const user = userEvent.setup();

        render(
          <BrowserRouter>
            <AddPatient />
          </BrowserRouter>
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
        const prebookOption = await screen.findByText('Pre-booked In Person Visit');
        await user.click(prebookOption);

        // Try to submit without selecting a slot
        const addButton = screen.getByTestId(dataTestIds.addPatientPage.addButton);
        await user.click(addButton);

        // Should show warning dialog
        const dialogMessage = await screen.findByText('To continue, please select an available appointment.');
        expect(dialogMessage).toBeVisible();
      },
      { timeout: 10000 }
    );

    it(
      'Shows dialog when clicking Add for post-telemed visit without selecting a time slot',
      async () => {
        const user = userEvent.setup();

        render(
          <BrowserRouter>
            <AddPatient />
          </BrowserRouter>
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
        const postTelemedOption = await screen.findByText('Post Telemed Lab Only');
        await user.click(postTelemedOption);

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
});
