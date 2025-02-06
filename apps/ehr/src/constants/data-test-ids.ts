import { PractitionerQualificationCode, RoleType } from 'utils';

export const dataTestIds = {
  header: {
    userName: 'header-user-name',
  },
  cssHeader: {
    container: 'css-header-container',
  },
  dashboard: {
    addPatientButton: 'add-patient-button',
    intakeButton: (appointmentId: string) => `intake-button-${appointmentId}`,
    prebookedTab: 'prebooked-tab',
    locationSelect: 'location-select',
    datePickerTodayButton: 'date-picker-today-button',
    loadingIndicator: 'loading-indicator',
    tableRowWrapper: (appointmentId: string) => `appointments-table-row-${appointmentId}`,
    tableRowStatus: (appointmentId: string) => `appointments-table-row-status-${appointmentId}`,
    patientName: 'patient-name',
    appointmentTime: 'appointment-time',
    inOfficeTab: 'in-office-tab',
    groupSelect: 'group-select',
  },
  appointmentPage: {
    patientFullName: 'patient-full-name',
  },
  addPatientPage: {
    mobilePhoneInput: 'mobile-phone-input',
    searchForPatientsButton: 'search-for-patients-button',
    addButton: 'add-button',
    cancelButton: 'cancel-button',
    patientNotFoundButton: 'patient-not-found-button',
    firstNameInput: 'first-name-input',
    lastNameInput: 'last-name-input',
    sexAtBirthDropdown: 'sex-at-birth-dropdown',
    reasonForVisitDropdown: 'reason-for-visit-dropdown',
    visitTypeDropdown: 'visit-type-dropdown',
    dateFormatValidationError: 'date-format-validation-error',
    prefillForButton: 'prefill-for-button',
    prefilledPatientName: 'prefilled-patient-name',
    prefilledPatientBirthday: 'prefilled-patient-birthday',
    prefilledPatientBirthSex: 'prefilled-patient-birth-sex',
    prefilledPatientEmail: 'prefilled-patient-email',
  },
  pagination: {
    nextPage: 'KeyboardArrowRightIcon',
    previousPage: 'KeyboardArrowLeftIcon',
    paginationContainer: 'pagination-container',
    dropDownArrow: 'ArrowDropDownIcon',
  },
  patientHeader: {
    patientId: 'header-patient-id',
    patientName: 'header-patient-name',
    patientBirthSex: 'header-patient-birth-sex',
    patientBirthday: 'header-patient-birthday',
    patientAddress: 'header-patient-address',
    patientPhoneNumber: 'header-patient-phone-number',
    emergencyContact: 'header-emergency-contact',
  },
  patientInformation: {
    patientLastName: 'patient-last-name',
    patientFirstName: 'patient-first-name',
    patientBirthSex: 'patient-birth-sex',
    streetAddress: 'street-address',
    city: 'city',
    state: 'state',
    zip: 'zip',
    fillingThisInfoAs: 'filling-this-info-as',
    parentGuardianEmail: 'parent-guardian-email',
    patientEmail: 'patient-email',
    patientMobile: 'patient-mobile',
    patientsEthnicity: 'patients-ethnicity',
    patientsRace: 'patients-race',
    howDidYouHearAboutUs: 'how-did-you-hear-about-us',
    fullName: 'full-name',
  },
  slots: {
    slot: 'slot',
  },
  dialog: {
    closeButton: 'close-button',
  },
  statesPage: {
    statesSearch: 'states-search',
  },
  patients: {
    searchByNameField: 'search-name-field',
    searchByDateOfBirthField: 'searchByDateOfBirthField',
    searchByPhoneField: 'search-phone-field',
    searchByAddressField: 'search-by-address',
    searchByEmailField: 'search-by-email-field',
    searchByStatusName: 'search-by-status-name',
    searchByLocationName: 'search-by-location-name',
    searchButton: 'search-button',
    resetFiltersButton: 'reset-filters-button',
    patientId: 'patient-id',
    patientName: 'patient-name',
    patientDateOfBirth: 'patient-date-of-birth',
    patientEmail: 'patient-email',
    patientPhoneNumber: 'patient-phone-number',
    patientAddress: 'patient-address',
    searchResultRow: (patientId: string) => `search-result-row-${patientId}`,
  },
  employeesPage: {
    table: 'employees-providers-content-table',
    providersTabButton: 'providers-tab-button',
    searchByName: 'search-by-name-field',
    providersStateFilter: 'providers-state-filter',
    informationForm: 'employee-information-form',
    firstName: 'employee-first-name',
    middleName: 'employee-middle-name',
    lastName: 'employee-last-name',
    email: 'employee-email',
    phone: 'employee-phone',
    rolesSection: 'employee-roles-section',
    roleRow: (employeeRole: RoleType): string => `employee-${employeeRole}-role`,
    providerDetailsCredentials: 'employees-provider-details-credentials',
    providerDetailsNPI: 'employees-provider-details-npi',
    submitButton: 'employees-form-submit-button',
    qualificationsTable: 'employee-qualifications-table',
    qualificationRow: (code: PractitionerQualificationCode): string => `employee-${code}-qualification`,
    deleteQualificationButton: 'employee-delete-qualification-button',
    addQualificationAccordion: 'add-new-qualification-accordion',
    newQualificationStateDropdown: 'new-qualification-state-dropdown',
    newQualificationTypeDropdown: 'new-qualification-type-dropdown',
    addQualificationButton: 'add-qualification-button',
    deactivateUserButton: 'deactivate-user-button',
    statusChip: 'employee-status-chip',
  },
  insurancesPage: {
    insuranceSearch: 'insurance-search',
    statusDropdown: 'status-dropdown',
    addNewButton: 'add-new-button',
  },
  newInsurancePage: {
    payerName: 'payer-name',
    saveChangesButton: 'save-changes-button',
    activateButton: 'activate-button',
  },
};
