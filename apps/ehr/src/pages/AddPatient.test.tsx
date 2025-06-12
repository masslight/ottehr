import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BrowserRouter } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { describe, expect, it } from 'vitest';
import AddPatient from './AddPatient';

describe('AddPatient', () => {
  const server = setupServer(
    http.post('https://fhir-api.zapehr.com/Location/_search', () => {
      return HttpResponse.json({ greeting: 'hello there' });
    }),
    http.post('https://fhir-api.zapehr.com/Person/_search', () => {
      return HttpResponse.json({ greeting: 'hello there' });
    })
  );

  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Renders with appropriate fields', () => {
    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    const locationHeader = screen.getByTestId(dataTestIds.addPatientPage.locationHeader);
    expect(locationHeader).toBeVisible();
  });

  it('Should show a validation error that phone number is required when search for patients is clicked before any phone number is entered', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));
    const errorMessage = screen.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx');
    expect(errorMessage).toBeVisible();
  });

  it('Should use HTML5 required validation for all required fields', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    expect(screen.getByTestId(dataTestIds.dashboard.locationSelect).querySelector('input')).toHaveAttribute('required');

    const phoneNumberEntryField = screen
      .getByTestId(dataTestIds.addPatientPage.mobilePhoneInput)
      .querySelector('input');
    expect(phoneNumberEntryField).toBeInTheDocument();
    expect(phoneNumberEntryField).toHaveAttribute('required');

    await user.click(phoneNumberEntryField!);
    await user.paste('1234567890'); // Sufficiently valid phone number
    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

    // If this is visible then we are ready to test the broader form validations
    const firstNameInput = screen.getByTestId(dataTestIds.addPatientPage.firstNameInput).querySelector('input');
    expect(firstNameInput).toBeVisible();

    expect(firstNameInput).toHaveAttribute('required');
    expect(screen.getByTestId(dataTestIds.addPatientPage.lastNameInput).querySelector('input')).toHaveAttribute(
      'required'
    );
    expect(await screen.findByPlaceholderText('MM/DD/YYYY')).toHaveAttribute('required');

    expect(
      (await screen.findByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown)).querySelector('input')
    ).toHaveAttribute('required');

    expect(
      (await screen.findByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown)).querySelector('input')
    ).toHaveAttribute('required');

    expect(
      (await screen.findByTestId(dataTestIds.addPatientPage.visitTypeDropdown)).querySelector('input')
    ).toHaveAttribute('required');
  });

  it('Should use HTML5 required validation for all required fields', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    expect(screen.getByTestId(dataTestIds.dashboard.locationSelect).querySelector('input')).toHaveAttribute('required');

    const phoneNumberEntryField = screen
      .getByTestId(dataTestIds.addPatientPage.mobilePhoneInput)
      .querySelector('input');
    expect(phoneNumberEntryField).toBeInTheDocument();
    expect(phoneNumberEntryField).toHaveAttribute('required');

    await user.click(phoneNumberEntryField!);
    await user.paste('1234567890'); // Sufficiently valid phone number
    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));

    // If this is visible then we are ready to test the broader form validations
    const firstNameInput = screen.getByTestId(dataTestIds.addPatientPage.firstNameInput).querySelector('input');
    expect(firstNameInput).toBeVisible();

    expect(firstNameInput).toHaveAttribute('required');
    expect(screen.getByTestId(dataTestIds.addPatientPage.lastNameInput).querySelector('input')).toHaveAttribute(
      'required'
    );
    expect(await screen.findByPlaceholderText('MM/DD/YYYY')).toHaveAttribute('required');

    expect(
      (await screen.findByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown)).querySelector('input')
    ).toHaveAttribute('required');

    expect(
      (await screen.findByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown)).querySelector('input')
    ).toHaveAttribute('required');

    expect(
      (await screen.findByTestId(dataTestIds.addPatientPage.visitTypeDropdown)).querySelector('input')
    ).toHaveAttribute('required');
  });
});
