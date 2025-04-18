import { ApptTelemedTab, PractitionerQualificationCode, RoleType, TelemedAppointmentVisitTabs } from 'utils';

export const dataTestIds = {
  closeIcon: 'CloseIcon',
  loadingSpinner: 'loading-spinner',
  deleteOutlinedIcon: 'DeleteOutlinedIcon',
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
    inOfficeTab: 'in-office-tab',
    groupSelect: 'group-select',
    dischargedTab: 'discharged-tab',
    cancelledTab: 'cancelled-tab',
    arrivedButton: 'arrived-button',
    appointmentStatus: 'appointment-status',
    chatButton: 'Chat-outlined-icon',
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
    patientDateOfBirth: 'patient-date-of-birth',
    patientMiddleName: 'patient-middle-name',
    patientSuffix: 'patient-suffix',
    patientPreferredName: 'patient-preferred-name',
    patientPreferredPronouns: 'patient-preferred-pronouns',
  },
  contactInformationContainer: {
    streetAddress: 'street-address',
    addressLineOptional: 'address-line-optional',
    city: 'city',
    state: 'state',
    zip: 'zip',
    patientMobile: 'patient-mobile',
    patientEmail: 'patient-email',
  },
  patientDetailsContainer: {
    patientsEthnicity: 'patients-ethnicity',
    patientsRace: 'patients-race',
    sexualOrientation: 'sexual-orientation',
    genderIdentity: 'gender-identity',
    howDidYouHearAboutUs: 'how-did-you-hear-about-us',
    sendMarketingMessages: 'send-marketing-messages',
    preferredLanguage: 'preffered-language',
    commonWellConsent: 'commonwell-consent',
  },
  primaryCarePhysicianContainer: {
    pcpCheckbox: 'pcp-checkbox',
    firstName: ' primaryCarePhysicianContainer-first-name',
    lastName: ' primaryCarePhysicianContainer-last-name',
    practiceName: ' primaryCarePhysicianContainer-practice-name',
    address: ' primaryCarePhysicianContainer-address',
    mobile: ' primaryCarePhysicianContainer-mobile',
  },

  responsiblePartyInformationContainer: {
    id: 'responsible-party-information-container',
    relationshipDropdown: 'responsible-party-information-container-relationship-dropdown',
    firstName: 'responsible-party-information-container-first-name',
    lastName: 'responsible-party-information-container-last-name',
    dateOfBirthDropdown: 'responsible-party-information-container-date-of-birth-dropdown',
    birthSexDropdown: 'responsible-party-information-container-birth-sex-dropdown',
    phoneInput: 'responsible-party-information-container-phone-input',
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
    addQualificationCard: 'add-new-qualification-card',
    newQualificationStateDropdown: 'new-qualification-state-dropdown',
    newQualificationTypeDropdown: 'new-qualification-type-dropdown',
    newQualificationNumberField: 'new-qualification-number-field',
    newQualificationExpDatePicker: 'new-qualification-expiration-date-picker',
    addQualificationButton: 'add-qualification-button',
    deactivateUserButton: 'deactivate-user-button',
    statusChip: 'employee-status-chip',
  },
  telemedEhrFlow: {
    trackingBoardLocationsSelect: 'telemed-tracking-board-location-select',
    telemedAppointmentsTabs: (tab: ApptTelemedTab) => `telemed-appointments-tabs-${tab}`,
    trackingBoardTableGroupRow: `telemed-tracking-board-table-group-row`,
    trackingBoardTableRow: (appointmentId: string) => `telemed-tracking-board-table-row-${appointmentId}`,
    myPatientsButton: 'telemed-my-patients-button',
    allPatientsButton: 'telemed-all-patients-button',
    trackingBoardTable: 'telemed-tracking-board-table',
    trackingBoardAssignButton: 'telemed-tracking-board-assign-appointment-button',
    trackingBoardViewButton: (appointmentId?: string) =>
      `telemed-tracking-board-view-appointment-button-${appointmentId}`,
    trackingBoardChatButton: (appointmentId?: string) =>
      `telemed-tracking-board-chat-appointment-button-${appointmentId}`,
    appointmentStatusChip: 'telemed-appointment-status-chip',
    footerButtonConnectToPatient: 'telemed-appointment-footer-button-connect-to-patient',
    footerButtonAssignMe: 'telemed-appointment-footer-button-assign-me',
    footerButtonUnassign: 'telemed-appointment-footer-button-unassign',
    appointmentChartFooter: 'telemed-chart-appointment-footer',
    hpiFieldListLoadingSkeleton: 'telemed-hpi-field-list-loading-skeleton',
    hpiMedicalConditionColumn: 'telemed-hpi-medical-condition-column',
    hpiMedicalConditionsList: 'telemed-hpi-medical-condition-list',
    hpiMedicalConditionPatientProvidedsList: 'telemed-hpi-medical-condition-patient-provided-list',
    hpiMedicalConditionsInput: 'telemed-hpi-medical-condition-input',
    hpiMedicalConditionListItem: 'telemed-hpi-medical-condition-list-item',
    hpiCurrentMedicationsPatientProvidedsList: 'telemed-hpi-current-medications-patient-provided-list',
    hpiCurrentMedicationsInput: 'telemed-hpi-current-medications-input',
    hpiCurrentMedicationsDoseInput: 'telemed-hpi-current-medications-dose-input',
    hpiCurrentMedicationsDateInput: 'telemed-hpi-current-medications-date-input',
    hpiCurrentMedicationsTimeInput: 'telemed-hpi-current-medications-time-input',
    hpiCurrentMedicationsAddButton: 'telemed-hpi-current-medications-add-button',
    hpiCurrentMedicationsScheduledList: 'telemed-hpi-current-medications-scheduled-list',
    hpiCurrentMedicationsAsNeededList: 'telemed-hpi-current-medications-as-needed-list',
    hpiCurrentMedicationsScheduledRadioButton: 'telemed-hpi-current-medications-scheduled-radio-button',
    hpiCurrentMedicationsAsNeededRadioButton: 'telemed-hpi-current-medications-as-needed-radio-button',
    hpiCurrentMedicationsList: (listType: 'scheduled' | 'as-needed') =>
      `telemed-hpi-current-medications-list-${listType}`,
    hpiCurrentMedicationsListItem: (listDataTestId: string) => `${listDataTestId}-item`,
    hpiCurrentMedicationsColumn: 'telemed-hpi-current-medications-column',
    hpiKnownAllergiesColumn: 'telemed-hpi-known-allergies-column',
    hpiKnownAllergiesList: 'telemed-hpi-known-allergies-list',
    hpiKnownAllergiesPatientProvidedList: 'telemed-hpi-known-allergies-patient-provided-list',
    hpiKnownAllergiesInput: 'telemed-hpi-known-allergies-input',
    hpiKnownAllergiesListItem: 'telemed-hpi-known-allergies-list-item',
    hpiSurgicalHistoryColumn: 'telemed-hpi-surgical-history-column',
    hpiSurgicalHistoryList: 'telemed-hpi-surgical-history-list',
    hpiSurgicalHistoryPatientProvidedList: 'telemed-hpi-surgical-history-patient-provided-list',
    hpiSurgicalHistoryInput: 'telemed-hpi-surgical-history-input',
    hpiSurgicalHistoryListItem: 'telemed-hpi-surgical-history-list-item',
    hpiAdditionalQuestions: (questionSymptom: string) => `telemed-additional-questions-${questionSymptom}`,
    hpiAdditionalQuestionsPatientProvided: (questionSymptom: string) =>
      `telemed-additional-questions-patient-provided-${questionSymptom}`,
    hpiSurgicalHistoryNote: 'telemed-hpi-surgical-history-note',
    hpiChiefComplaintNotes: 'telemed-chief-complaint-notes',
    hpiChiefComplaintRos: 'telemed-chief-complaint-ros',
    hpiPatientConditionPhotos: 'telemed-patient-condition-photos',
    hpiReasonForVisit: 'telemed-reason-for-visit',
    videoRoomContainer: 'telemed-video-room-container',
    endVideoCallButton: 'telemed-end-video-call-button',
    appointmentVisitTabs: (tab: TelemedAppointmentVisitTabs) => `telemed-appointment-visit-tab-${tab}`,
    patientInfoConfirmationCheckbox: 'telemed-patient-info-confirmation-checkbox',
    signButton: 'telemed-sign-button',
    reviewTabMedicalConditionsContainer: 'telemed-review-tab-medical-conditions-container',
    reviewTabKnownAllergiesContainer: 'telemed-review-tab-known-allergies-container',
    reviewTabMedicationsContainer: 'telemed-review-tab-medications-container',
    reviewTabSurgicalHistoryContainer: 'telemed-review-tab-surgical-history-container',
    cancelThisVisitButton: 'telemed-cancel-this-visit-button',
    inviteParticipant: 'telemed-invite-participant-button',
    editPatientButtonSideBar: 'telemed-edit-patient-button-side-bar',
    chatModalDescription: 'telemed-chat-modal-description',
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
    missingCard: 'missing-card',
    missingCardText: 'missing-card-text',
    primaryDiagnosisLink: 'primary-diagnosis-link',
    secondaryDiagnosisLink: 'secondary-diagnosis-link',
    medicalDecisionLink: 'medical-decision-link',
    emCodeLink: 'em-code-link',
    visitNoteCard: 'visit-note-card',
  },
  assessmentPage: {
    diagnosisDropdown: 'diagnosis-dropdown',
    emCodeDropdown: 'em-code-dropdown',
    medicalDecisionField: 'medical-decision-field',
  },
  diagnosisContainer: {
    primaryDiagnosis: 'diagnosis-container-primary-diagnosis',
    secondaryDiagnosis: 'diagnosis-container-secondary-diagnosis',
    primaryDiagnosisDeleteButton: 'diagnosis-container-primary-diagnosis-delete-button',
    secondaryDiagnosisDeleteButton: 'diagnosis-container-secondary-diagnosis-delete-button',
    makePrimaryButton: 'diagnosis-container-make-primary-button',
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
    marTableDoseCell: 'mar-table-dose-cell',
    marTableRouteCell: 'mar-table-route-cell',
    marTableInstructionsCell: 'mar-table-instructions-cell',
    medicationDetailsTab: 'medication-details-tab',
    pencilIconButton: 'EditOutlinedIcon',
  },
  orderMedicationPage: {
    inputField: (field: string): string => `input-${field}`,
    fillOrderToSaveButton: 'fill-order-to-save-button',
    backButton: 'back-button',
  },
  visitDetailsPage: {
    cancelVisitButton: 'cancel-visit-button',
    cancelationReasonDropdown: 'cancelation-reason-dropdown',
    cancelVisitDialogue: 'cancel-visit-dialogue',
  },
  patientRecordPage: {
    seeAllPatientInfoButton: 'see-all-patient-info-button',
  },
};
