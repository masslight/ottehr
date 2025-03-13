import { AppointmentVisitTabs, ApptTelemedTab, PractitionerQualificationCode, RoleType } from 'utils';

export const dataTestIds = {
  header: {
    userName: 'header-user-name',
  },
  cssHeader: {
    container: 'css-header-container',
    patientName: 'patient-name',
    appointmentStatus: 'appointment-status',
    switchStatusButton: (status: string) => `switch-status-to-${status}`,
  },
  dashboard: {
    appointmentsTable: (tab: 'prebooked' | 'in-office' | 'completed' | 'cancelled') => `appointments-table-${tab}`,
    addPatientButton: 'add-patient-button',
    intakeButton: `intake-button`,
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
    dischargedTab: 'discharged-tab',
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
    paginationContainer: 'pagination-container',
  },
  patientInformationPage: {
    saveChangesButton: 'save-changes-button',
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
  patientInformationContainer: {
    patientLastName: 'patient-last-name',
    patientFirstName: 'patient-first-name',
    patientBirthSex: 'patient-birth-sex',
  },
  contactInformationContainer: {
    streetAddress: 'street-address',
    city: 'city',
    state: 'state',
    zip: 'zip',
    patientMobile: 'patient-mobile',
    patientEmail: 'patient-email',
  },
  patientDetailsContainer: {
    patientsEthnicity: 'patients-ethnicity',
    patientsRace: 'patients-race',
  },
  responsiblePartyInformationContainer: {
    id: 'responsible-party-information-container',
    relationshipDropdown: 'relationship-dropdown',
    fullName: 'full-name',
    dateOfBirthDropdown: 'date-of-birth-dropdown',
    birthSexDropdown: 'birth-sex-dropdown',
    phoneInput: 'phone-input',
  },

  userSettingsContainer: {
    releaseOfInfoDropdown: 'release-of-info-dropdown',
    RxHistoryConsentDropdown: 'Rx-history-consent-dropdown',
  },

  slots: {
    slot: 'slot',
  },
  dialog: {
    closeButton: 'close-button',
    proceedButton: 'proceed-button',
  },
  statesPage: {
    statesSearch: 'states-search',
    stateValue: 'state-value',
    operateInStateValue: 'operate-in-state-value',
    stateRow: (stateValue: string) => `state-row-${stateValue}`,
  },
  editState: {
    saveChangesButton: 'save-changes-button',
    cancelButton: 'cancel-button',
    operateInStateToggle: 'operate-in-state-toggle',
    stateNameTitle: 'state-name-title',
    stateNameField: 'state-name-field',
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
    searchResultsRowPrefix: 'search-result-row-',
    searchResultRow: (patientId: string) => `${dataTestIds.patients.searchResultsRowPrefix}${patientId}`,
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
  telemedEhrFlow: {
    telemedAppointmentsTabs: (tab: ApptTelemedTab) => `telemed-appointments-tabs-${tab}`,
    trackingBoardTableRow: (appointmentId: string) => `telemed-tracking-board-table-row-${appointmentId}`,
    myPatientsButton: 'telemed-my-patients-button',
    allPatientsButton: 'telemed-all-patients-button',
    trackingBoardTable: 'telemed-tracking-board-table',
    trackingBoardAssignButton: 'telemed-tracking-board-assign-appointment-button',
    trackingBoardViewButton: (appointmentId?: string) =>
      `telemed-tracking-board-view-appointment-button-${appointmentId}`,
    appointmentStatusChip: 'telemed-appointment-status-chip',
    footerButtonConnectToPatient: 'telemed-appointment-footer-button-connect-to-patient',
    footerButtonAssignMe: 'telemed-appointment-footer-button-assign-me',
    appointmentChartFooter: 'telemed-chart-appointment-footer',
    hpiMedicalConditionsLoadingSkeleton: 'telemed-medical-conditions-loading-skeleton',
    hpiMedicalConditionColumn: 'telemed-hpi-medical-condition-column',
    hpiMedicalConditionsList: 'telemed-hpi-medical-condition-list',
    hpiMedicalConditionsInput: 'telemed-hpi-medical-condition-input',
    hpiKnownAllergiesColumn: 'telemed-hpi-known-allergies-column',
    hpiKnownAllergiesList: 'telemed-hpi-known-allergies-list',
    hpiKnownAllergiesInput: 'telemed-hpi-known-allergies-input',
    hpiSurgicalHistoryColumn: 'telemed-hpi-surgical-history-column',
    // hpiSurgicalHistoryList: 'telemed-hpi-surgical-history-list',
    hpiSurgicalHistoryInput: 'telemed-hpi-surgical-history-input',
    hpiAdditionalQuestions: (questionSymptom: string) => `telemed-additional-questions-${questionSymptom}`,
    hpiSurgicalHistoryNote: 'telemed-hpi-surgical-history-note',
    hpiChiefComplaintNotes: 'telemed-chief-complaint-notes',
    hpiChiefComplaintRos: 'telemed-chief-complaint-ros',
    videoRoomContainer: 'telemed-video-room-container',
    endVideoCallButton: 'telemed-end-video-call-button',
    appointmentVisitTabs: (tab: AppointmentVisitTabs) => `telemed-appointment-visit-tab-${tab}`,
    diagnosisAutocomplete: 'telemed-diagnosis-autocomplete',
    emCodeAutocomplete: 'telemed-em-code-autocomplete',
    patientInfoConfirmationCheckbox: 'telemed-patient-info-confirmation-checkbox',
    signButton: 'telemed-sign-button',
  },
  sideMenu: {
    completeIntakeButton: 'complete-intake-button',
    sideMenuItem: (item: string): string => `menu-item-${item}`,
  },
  hospitalizationPage: {
    hospitalizationTitle: 'hospitalization-title',
  },
  progressNotePage: {
    reviewAndSignButton: 'review-and-sign-button',
  },
  assessmentPage: {
    diagnosisDropdown: 'diagnosis-dropdown',
    emCodeDropdown: 'em-code-dropdown',
    medicalDecisionField: 'medical-decision-field',
  },
  diagnosisContainer: {
    deleteButton: 'diagnosis-container-delete-button',
  },
  billingContainer: {
    deleteButton: 'billing-container-delete-button',
  },
  patientInfoPage: {
    patientInfoVerifiedCheckbox: 'patient-info-verified-checkbox',
  },
  inHouseMedicationsPage: {
    title: 'medications-title',
    orderButton: 'order-button',
    marTableRow: 'mar-table-row',
    marTableMedicationCell: 'mar-table-medication-cell',
    marTableStatusCell: 'mar-table-status-cell',
    medicationDetailsTab: 'medication-details-tab',
  },
  orderMedicationPage: {
    inputField: (field: string): string => `input-${field}`,
    fillOrderToSaveButton: 'fill-order-to-save-button',
    backButton: 'back-button',
  },
  patientRecordPage: {
    seeAllPatientInfoButton: 'see-all-patient-info-button',
  },
};
