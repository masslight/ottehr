import '@testing-library/jest-dom';
import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { describe, expect, it, vi } from 'vitest';
import AddPatient from './AddPatient';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe('AddPatient', () => {
  const server = setupServer(
    http.post('https://fhir-api.zapehr.com/Location/_search', () => {
      return HttpResponse.json({ greeting: 'hello there' });
    }),
    http.post('https://fhir-api.zapehr.com/Person/_search', () => {
      return HttpResponse.json({ greeting: 'hello there' });
    })
    // http.post('https://project-api.zapehr.com/v1/zambda/get-schedule/execute-public', () => {
    //   return HttpResponse.json({
    //     status: 200,
    //     output: {
    //       message: 'Successfully retrieved all available slot times',
    //       available: [
    //         {
    //           slot: {
    //             resourceType: 'Slot',
    //             id: '7ed80758-1085-48a5-adb8-61ec1261b6d2|2025-06-16T09:30:00.000-04:00',
    //             start: '2025-06-16T09:30:00.000-04:00',
    //             serviceCategory: [
    //               {
    //                 coding: [
    //                   {
    //                     system: 'https://fhir.ottehr.com/slot-service-category',
    //                     code: 'in-person-service-mode',
    //                   },
    //                 ],
    //               },
    //             ],
    //             end: '2025-06-16T13:45:00.000+00:00',
    //             schedule: {
    //               reference: 'Schedule/7ed80758-1085-48a5-adb8-61ec1261b6d2',
    //             },
    //             status: 'free',
    //           },
    //           owner: {
    //             resourceType: 'Location',
    //             id: 'cdf183b2-c782-4567-9117-beee8066df1c',
    //             name: 'Selden- NY',
    //           },
    //           timezone: 'America/New_York',
    //         },
    //       ],
    //     },
    //   });
    // })
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

  it('Should test that when the user clicks on the cancel button, `navigate(/visits)` is called', async () => {
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

  it('Should show a validation error that phone number is invalid when search for patients is clicked with an invalid phone number in the field', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    const phoneNumberEntryField = screen
      .getByTestId(dataTestIds.addPatientPage.mobilePhoneInput)
      .querySelector('input');

    await user.click(phoneNumberEntryField!);
    await user.paste('123'); // Invalid number

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

  it('Should show a  validation error if date of birth field has an invalid date', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );
    const phoneNumberEntryField = screen
      .getByTestId(dataTestIds.addPatientPage.mobilePhoneInput)
      .querySelector('input');
    expect(phoneNumberEntryField).toBeInTheDocument();
    await user.click(phoneNumberEntryField!);
    await user.paste('1234567890'); // Sufficiently valid phone number
    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));
    const notFoundButton = screen.getByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
    await user.click(notFoundButton);

    const dateOfBirthInput = await screen.findByPlaceholderText('MM/DD/YYYY');
    expect(dateOfBirthInput).toBeVisible();
    await user.click(dateOfBirthInput);
    await user.paste('3'); // Invalid date
    await user.tab(); // Trigger validation
    const errorMessage = screen.getByText('please enter date in format MM/DD/YYYY');
    expect(errorMessage).toBeVisible();
  });

  it('Should show a popup if user is in prebook visit type and does not select a slot', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AddPatient />
      </BrowserRouter>
    );

    const phoneNumberEntryField = screen
      .getByTestId(dataTestIds.addPatientPage.mobilePhoneInput)
      .querySelector('input');
    expect(phoneNumberEntryField).toBeInTheDocument();
    await user.click(phoneNumberEntryField!);
    await user.paste('1234567890'); // Sufficiently valid phone number
    await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));
    const notFoundButton = screen.getByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
    await user.click(notFoundButton);

    await waitForElementToBeRemoved(notFoundButton);

    const visitTypeDropdownButton = within(screen.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown)).getByRole(
      'combobox'
    );
    await user.click(visitTypeDropdownButton);

    const prebookOption = await screen.getByText('Pre-booked In Person Visit');
    expect(prebookOption).toBeVisible();
    await user.click(prebookOption);
    const addButton = screen.getByTestId(dataTestIds.addPatientPage.addButton);
    await user.click(addButton);

    const slotSelectionPopup = screen.getByText('To continue, please select an available appointment.');
    expect(slotSelectionPopup).toBeVisible();
    // screen.debug(undefined, Infinity);
  });
});
