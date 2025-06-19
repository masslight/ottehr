import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from '../../src/helpers/data-test-ids';

export const CURRENT_MEDICATIONS_PRESENT_LABEL = 'Patient takes medication currently';
export const CURRENT_MEDICATIONS_ABSENT_LABEL = 'Patient does not take any medications currently';

export const KNOWN_ALLERGIES_PRESENT_LABEL = 'Patient has known current allergies';
export const KNOWN_ALLERGIES_ABSENT_LABEL = 'Patient has no known current allergies';

export const MEDICAL_CONDITIONS_PRESENT_LABEL = 'Patient has current medical conditions';
export const MEDICAL_CONDITIONS_ABSENT_LABEL = 'Patient has no current medical conditions';

export const SURGICAL_HISTORY_PRESENT_LABEL = 'Patient has surgical history';
export const SURGICAL_HISTORY_ABSENT_LABEL = 'Patient has no surgical history';

export class Locators {
  page: Page;
  scheduleInPersonVisitButton: Locator;
  scheduleVirtualVisitButton: Locator;
  differentFamilyMember: Locator;
  continueButton: Locator;
  reserveButton: Locator;
  thankYouHeading: Locator;
  locationName: Locator;
  prebookSlotReviewScreen: Locator;
  titleVisitDetails: Locator;
  titlePatient: Locator;
  descReviewScreen: Locator;
  pageTitle: Locator;
  privacyPolicyReviewScreen: Locator;
  termsAndConditions: Locator;
  proceedToPaperwork: Locator;
  firstAvailableTime: Locator;
  firstAvailableTimeButton: Locator;
  editPencilReviewScreen: Locator;
  modifyTimeThankYouScreen: Locator;
  cancelVisitThankYouScreen: Locator;
  cancelScreenHeading: Locator;
  submitModifyTime: Locator;
  cancellationReasonField: Locator;
  cancelVisitButton: Locator;
  cancelConfirmationScreenHeading: Locator;
  bookAgainButton: Locator;
  homeScreenHeading: Locator;
  streetAddress: Locator;
  streetAddressLine2: Locator;
  patientCity: Locator;
  patientState: Locator;
  patientZip: Locator;
  patientEmail: Locator;
  patientNumber: Locator;
  mobileOptIn: Locator;
  patientEthnicity: Locator;
  patientRace: Locator;
  patientPreferredLanguage: Locator;
  selfPayOption: Locator;
  responsiblePartyRelationship: Locator;
  responsiblePartyFirstName: Locator;
  responsiblePartyLastName: Locator;
  responsiblePartyBirthSex: Locator;
  hipaaAcknowledgement: Locator;
  consentToTreat: Locator;
  signature: Locator;
  consentFullName: Locator;
  consentSignerRelationship: Locator;
  editPaperwork: Locator;
  flowHeading: Locator;
  startInPersonVisitButton: Locator;
  confirmWalkInButton: Locator;
  checkInHeading: Locator;
  patientPronouns: Locator;
  patientMyPronounsLabel: Locator;
  patientMyPronounsInput: Locator;
  patientPointOfDiscovery: Locator;
  pcpFirstName: Locator;
  pcpLastName: Locator;
  pcpPractice: Locator;
  pcpAddress: Locator;
  pcpNumber: Locator;
  backButton: Locator;
  pcpNumberErrorText: Locator;
  appointmentDescription: Locator;
  goToWaitingRoomButton: Locator;
  clearImage: Locator;
  photoIdFrontImage: Locator;
  photoIdBackImage: Locator;
  responsiblePartyNumber: Locator;
  responsiblePartyAddress1: Locator;
  responsiblePartyCity: Locator;
  responsiblePartyState: Locator;
  responsiblePartyZip: Locator;
  numberErrorText: Locator;
  zipErrorText: Locator;
  responsiblePartyDOBAnswer: Locator;
  dateOlder18YearsError: Locator;
  dateFutureError: Locator;
  calendarCurrentDay: Locator;
  calendarButtonOK: Locator;
  calendarArrowRight: Locator;
  calendarArrowDown: Locator;
  calendarDay: Locator;
  insuranceOption: Locator;
  insuranceHeading: Locator;
  insuranceCarrier: Locator;
  insuranceCarrierFirstOption: Locator;
  insuranceMemberID: Locator;
  policyHolderFirstName: Locator;
  policyHolderLastName: Locator;
  policyHolderMiddleName: Locator;
  policyHolderBirthSex: Locator;
  patientRelationship: Locator;
  policyHolderAddress: Locator;
  policyHolderAddressLine2: Locator;
  policyHolderCity: Locator;
  policyHolderState: Locator;
  policyHolderZip: Locator;
  policyHolderDOB: Locator;
  insuranceFrontImage: Locator;
  insuranceBackImage: Locator;
  secondaryInsuranceCarrier: Locator;
  secondaryInsuranceMemberID: Locator;
  secondaryPolicyHolderFirstName: Locator;
  secondaryPolicyHolderLastName: Locator;
  secondaryPolicyHolderMiddleName: Locator;
  secondaryPolicyHolderBirthSex: Locator;
  secondaryPatientRelationship: Locator;
  secondaryPolicyHolderAddress: Locator;
  secondaryPolicyHolderAddressLine2: Locator;
  secondaryPolicyHolderCity: Locator;
  secondaryPolicyHolderState: Locator;
  secondaryPolicyHolderZip: Locator;
  secondaryPolicyHolderDOB: Locator;
  secondaryInsuranceFrontImage: Locator;
  secondaryInsuranceBackImage: Locator;
  secondaryInsuranceCarrierSecondOption: Locator;
  addSecondaryInsurance: Locator;
  removeSecondaryInsurance: Locator;
  secondaryInsuranceHeading: Locator;
  policyAddressIsTheSame: Locator;
  secondaryPolicyAddressIsTheSame: Locator;
  creditCardNumber: Locator;
  creditCardExpiry: Locator;
  creditCardCVC: Locator;
  addCardButton: Locator;
  paperworkSelectOptionFieldErrorMessage: Locator;
  paperworkErrorInFieldAboveMessage: Locator;
  currentMedicationsPresent: Locator;
  currentMedicationsAbsent: Locator;
  knownAllergiesPresent: Locator;
  knownAllergiesAbsent: Locator;
  medicalConditionsPresent: Locator;
  medicalConditionsAbsent: Locator;
  surgicalHistoryPresent: Locator;
  surgicalHistoryAbsent: Locator;
  covidSymptoms: (flag: string) => Locator;
  testedPositiveCovid: (flag: string) => Locator;
  travelUSA: (flag: string) => Locator;
  finishButton: Locator;
  patientNamePaperworkReviewScreen: Locator;
  locationNamePaperworkReviewScreen: Locator;
  checkInTimePaperworkReviewScreen: Locator;
  contactInformationEditButton: Locator;
  patientDetailsEditButton: Locator;
  pcpEditButton: Locator;
  insuranceDetailsEditButton: Locator;
  responsiblePartyEditButton: Locator;
  photoIdEditButton: Locator;
  consentFormsEditButton: Locator;
  contactInformationChipStatus: Locator;
  patientDetailsChipStatus: Locator;
  pcpChipStatus: Locator;
  insuranceDetailsChipStatus: Locator;
  responsiblePartyChipStatus: Locator;
  photoIdChipStatus: Locator;
  consentFormsChipStatus: Locator;
  relayServiceNo: Locator;
  relayServiceYes: Locator;
  deleteButton: Locator;
  photoPatientCondition: Locator;
  neitherNotes: Locator;
  schoolOnlyNotes: Locator;
  workOnlyNotes: Locator;
  schoolAndWorkNotes: Locator;
  templatesBlock: Locator;
  uploadSchoolTemplate: Locator;
  uploadWorkTemplate: Locator;
  schoolTemplateLabel: Locator;
  workTemplateLabel: Locator;
  removeFile: Locator;
  schoolNoteFile: Locator;
  workNoteFile: Locator;
  inviteParticipantYes: Locator;
  inviteeFirstName: Locator;
  inviteeLastName: Locator;
  inviteeEmail: Locator;
  inviteePhone: Locator;
  inviteeContactEmail: Locator;
  inviteeContactPhone: Locator;
  emailErrorText: Locator;
  currentMedicationsChipStatus: Locator;
  currentAllergiesChipStatus: Locator;
  medicalHistoryChipStatus: Locator;
  surgicalHistoryChipStatus: Locator;
  additionalQuestionsChipStatus: Locator;
  patientConditionChipStatus: Locator;
  schoolWorkNotesChipStatus: Locator;
  inviteParticipantChipStatus: Locator;
  currentMedicationsEditButton: Locator;
  currentAllergiesEditButton: Locator;
  medicalHistoryEditButton: Locator;
  surgicalHistoryEditButton: Locator;
  additionalQuestionsEditButton: Locator;
  patientConditionEditButton: Locator;
  schoolWorkNotesEditButton: Locator;
  inviteParticipantEditButton: Locator;
  manageParticipant: Locator;
  leaveWaitingRoom: Locator;
  cancelVisit: Locator;
  modalInviteParticipantTitle: Locator;
  sendInvite: Locator;
  inviteeList: Locator;
  modalManageParticipantsTitle: Locator;
  wrInviteeName: Locator;
  wrInviteeContact: Locator;
  cancelInvite: Locator;
  keepInvite: Locator;
  wrInviteePhoneNumber: Locator;
  wrInviteeEmail: Locator;
  wrInviteeFirstName: Locator;
  wrInviteeLastName: Locator;
  responsiblePartyAddress2: Locator;
  selectedCard: Locator;
  cardNumberFilled: Locator;
  itemAddedValue: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scheduleInPersonVisitButton = page.getByTestId(dataTestIds.scheduleInPersonVisitButton);
    this.scheduleVirtualVisitButton = page.getByTestId(dataTestIds.scheduleVirtualVisitButton);
    this.startInPersonVisitButton = page.getByTestId(dataTestIds.startInPersonVisitButton);
    this.differentFamilyMember = page.getByTestId(dataTestIds.differentFamilyMember);
    this.continueButton = page.getByTestId(dataTestIds.continueButton);
    if (this.continueButton == null) {
      this.continueButton = page.getByText('Continue');
    }
    this.flowHeading = page.getByTestId(dataTestIds.flowPageTitle);
    this.thankYouHeading = page.getByRole('heading', { name: 'Thank you for choosing Ottehr!' });
    this.startInPersonVisitButton = page.getByTestId(dataTestIds.startInPersonVisitButton);
    this.confirmWalkInButton = page.getByRole('button', { name: 'Confirm this walk-in time' });
    this.checkInHeading = page.getByRole('heading', { name: 'You are checked in!' });
    this.locationName = page.getByTestId(dataTestIds.locationNameReviewScreen);
    this.pageTitle = page.getByTestId(dataTestIds.flowPageTitle);
    this.proceedToPaperwork = page.getByRole('button', { name: 'Proceed to paperwork' });
    this.firstAvailableTime = page.getByText('First available time');
    this.editPaperwork = page.getByRole('button', { name: 'Edit paperwork' });
    this.backButton = page.getByTestId(dataTestIds.backButton);
    this.bookAgainButton = page.getByRole('button', { name: 'Book again' });
    this.homeScreenHeading = page.getByRole('heading', { name: 'Welcome to Ottehr' });
    this.numberErrorText = page.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx');
    this.emailErrorText = page.getByText('Email is not valid');
    this.zipErrorText = page.getByText('ZIP Code must be 5 numbers');
    this.dateOlder18YearsError = page.getByText('Must be 18 years or older');
    this.dateFutureError = page.getByText('Date may not be in the future');
    this.appointmentDescription = page.locator('.appointment-description');
    this.goToWaitingRoomButton = page.getByRole('button', { name: 'Go to the Waiting Room' });
    this.deleteButton = page.getByTestId(dataTestIds.deletedButton);

    // Review page locators
    this.prebookSlotReviewScreen = page.getByTestId(dataTestIds.prebookSlotReviewScreen);
    this.titleVisitDetails = page.getByRole('heading', { name: 'Visit details' });
    this.titlePatient = page.getByText('Patient');
    this.descReviewScreen = page.getByText('Review and confirm all details below.');
    this.privacyPolicyReviewScreen = page.getByTestId(dataTestIds.privacyPolicyReviewScreen);
    this.termsAndConditions = page.getByTestId(dataTestIds.termsAndConditionsReviewScreen);
    this.reserveButton = page.getByRole('button', { name: 'Reserve this check-in time' });
    this.confirmWalkInButton = page.getByRole('button', { name: 'Confirm this walk-in time' });

    // Modify locators
    this.firstAvailableTimeButton = page.getByRole('button', { name: 'First available time' });
    this.editPencilReviewScreen = page.getByTestId('EditOutlinedIcon');
    this.modifyTimeThankYouScreen = page.getByRole('button', { name: 'Modify' });
    this.submitModifyTime = page.getByRole('button', { name: 'Modify', exact: false });

    //Cancel visit locators
    this.cancelVisitThankYouScreen = page.getByRole('button', { name: 'Cancel' });
    this.cancelScreenHeading = page.getByText('Why are you canceling?');
    this.cancellationReasonField = page.locator('#cancellationReason');
    this.cancelVisitButton = page.getByRole('button', { name: 'Cancel visit' });
    this.cancelConfirmationScreenHeading = page.getByRole('heading', { name: 'Your visit has been canceled' });

    // Contact information locators
    this.streetAddress = page.locator('[id="patient-street-address"]');
    this.streetAddressLine2 = page.locator('[id="patient-street-address-2"]');
    this.patientCity = page.locator('[id="patient-city"]');
    this.patientState = page.locator('[id="patient-state"]');
    this.patientZip = page.locator('[id="patient-zip"]');
    this.patientEmail = page.locator('[id="patient-email"]');
    this.patientNumber = page.locator('[id="patient-number"]');

    // Patient details locators
    this.patientEthnicity = page.locator('[id="patient-ethnicity"]');
    this.patientRace = page.locator('[id="patient-race"]');
    this.patientPronouns = page.locator('[id="patient-pronouns"]');
    this.patientMyPronounsLabel = page.getByText('My pronouns');
    this.patientMyPronounsInput = page.locator('[id="patient-pronouns-custom"]');
    this.patientPreferredLanguage = page.locator('[id="preferred-language"]');
    this.patientPointOfDiscovery = page.locator('[id="patient-point-of-discovery"]');
    this.mobileOptIn = page.getByLabel('mobile-opt-in-label');
    //Telemed Patient details locators
    this.relayServiceNo = page.locator('[aria-labelledby="relay-phone-label"] input[type="radio"][value="No"]');
    this.relayServiceYes = page.locator('[aria-labelledby="relay-phone-label"] input[type="radio"][value="Yes"]');

    // Payment, insurance locators
    this.selfPayOption = page.getByLabel('I will pay without insurance');
    this.insuranceOption = page.getByLabel('I have insurance');
    this.insuranceHeading = page.getByText('Insurance details');
    this.insuranceCarrier = page.locator("[id='insurance-carrier']");
    this.insuranceCarrierFirstOption = page.locator("[id='insurance-carrier-option-0']");
    this.insuranceMemberID = page.locator("[id='insurance-member-id']");
    this.policyHolderFirstName = page.locator("[id='policy-holder-first-name']");
    this.policyHolderMiddleName = page.locator("[id='policy-holder-middle-name']");
    this.policyHolderLastName = page.locator("[id='policy-holder-last-name']");
    this.policyHolderBirthSex = page.locator("[id='policy-holder-birth-sex']");
    this.patientRelationship = page.locator("[id='patient-relationship-to-insured']");
    this.policyHolderAddress = page.locator('[id="policy-holder-address"]');
    this.policyHolderAddressLine2 = page.locator('[id="policy-holder-address-additional-line"]');
    this.policyHolderCity = page.locator('[id="policy-holder-city"]');
    this.policyHolderState = page.locator('[id="policy-holder-state"]');
    this.policyHolderZip = page.locator('[id="policy-holder-zip"]');
    this.policyHolderDOB = page.locator('[name="policy-holder-date-of-birth.answer.0.valueString"]');
    this.insuranceFrontImage = page.locator('#insurance-card-front-description');
    this.insuranceBackImage = page.locator('#insurance-card-back-description');
    this.policyAddressIsTheSame = page.getByLabel('policy-holder-address-as-patient-label');

    // Secondary insurance locators
    this.addSecondaryInsurance = page.getByRole('button', { name: 'Add Secondary Insurance' });
    this.removeSecondaryInsurance = page.getByRole('button', { name: 'Remove Secondary Insurance' });
    this.secondaryInsuranceHeading = page.getByText('Secondary insurance details');
    this.secondaryInsuranceCarrier = page.locator("[id='secondary-insurance.item.0']");
    this.secondaryInsuranceCarrierSecondOption = page.locator("[id='secondary-insurance.item.0-option-1']");
    this.secondaryInsuranceMemberID = page.locator("[id='secondary-insurance.item.1']");
    this.secondaryPolicyHolderFirstName = page.locator("[id='secondary-insurance.item.2']");
    this.secondaryPolicyHolderMiddleName = page.locator("[id='secondary-insurance.item.3']");
    this.secondaryPolicyHolderLastName = page.locator("[id='secondary-insurance.item.4']");
    this.secondaryPolicyHolderBirthSex = page.locator("[id='secondary-insurance.item.6']");
    this.secondaryPatientRelationship = page.locator("[id='secondary-insurance.item.13']");
    this.secondaryPolicyHolderAddress = page.locator('[id="secondary-insurance.item.8"]');
    this.secondaryPolicyHolderAddressLine2 = page.locator('[id="secondary-insurance.item.9"]');
    this.secondaryPolicyHolderCity = page.locator('[id="secondary-insurance.item.10"]');
    this.secondaryPolicyHolderState = page.locator('[id="secondary-insurance.item.11"]');
    this.secondaryPolicyHolderZip = page.locator('[id="secondary-insurance.item.12"]');
    this.secondaryPolicyHolderDOB = page.locator('[name="secondary-insurance.item.5.answer.0.valueString"]');
    this.secondaryInsuranceFrontImage = page.locator('[id="secondary-insurance.item.14-description"]');
    this.secondaryInsuranceBackImage = page.locator('[id="secondary-insurance.item.15-description"]');
    this.secondaryPolicyAddressIsTheSame = page.getByLabel('policy-holder-address-as-patient-2-label');

    // Credit Card locators
    const stripeIframe = page.frameLocator('iframe[title="Secure card payment input frame"]');
    this.creditCardNumber = stripeIframe.locator('[data-elements-stable-field-name="cardNumber"]');
    this.creditCardExpiry = stripeIframe.locator('[data-elements-stable-field-name="cardExpiry"]');
    this.creditCardCVC = stripeIframe.locator('[data-elements-stable-field-name="cardCvc"]');
    this.addCardButton = page.getByRole('button').filter({ hasText: 'Add card' });
    this.selectedCard = page.locator('[name="default-card-selection-group"]');
    this.cardNumberFilled = page.getByTestId(dataTestIds.cardNumber);

    // Responsible Party locators
    this.responsiblePartyRelationship = page.locator('[id="responsible-party-relationship"]');
    this.responsiblePartyFirstName = page.locator('[id="responsible-party-first-name"]');
    this.responsiblePartyLastName = page.locator('[id="responsible-party-last-name"]');
    this.responsiblePartyBirthSex = page.locator('[id="responsible-party-birth-sex"]');
    this.responsiblePartyNumber = page.locator('[id="responsible-party-number"]');
    this.responsiblePartyDOBAnswer = page.locator('[name="responsible-party-date-of-birth.answer.0.valueString"]');
    this.responsiblePartyAddress1 = page.locator('[id="responsible-party-address"]');
    this.responsiblePartyAddress2 = page.locator('[id="responsible-party-address-2"]');
    this.responsiblePartyCity = page.locator('[id="responsible-party-city"]');
    this.responsiblePartyState = page.locator('[id="responsible-party-state"]');
    this.responsiblePartyZip = page.locator('[id="responsible-party-zip"]');

    // Paperwork calendar locators
    this.calendarCurrentDay = page.locator('button[aria-current="date"]');
    this.calendarButtonOK = page.locator('button:has-text("OK")');
    this.calendarArrowRight = page.getByTestId('ArrowRightIcon');
    this.calendarArrowDown = page.locator('[role="presentation"] [data-testid="ArrowDropDownIcon"]');
    this.calendarDay = page.locator('div[aria-rowindex="2"] button[aria-colindex="1"]').nth(0);

    //Consent forms locators
    this.hipaaAcknowledgement = page.getByLabel('I have reviewed and accept HIPAA Acknowledgement *');
    this.consentToTreat = page.getByLabel(
      'I have reviewed and accept Consent to Treat, Guarantee of Payment & Card on File Agreement *'
    );
    this.signature = page.locator('[id="signature"]');
    this.consentFullName = page.locator('[id="full-name"]');
    this.consentSignerRelationship = page.locator('[id="consent-form-signer-relationship"]');

    // PCP locators
    this.pcpFirstName = page.locator('[id="pcp-first"]');
    this.pcpLastName = page.locator('[id="pcp-last"]');
    this.pcpPractice = page.locator('[id="pcp-practice"]');
    this.pcpAddress = page.locator('[id="pcp-address"]');
    this.pcpNumber = page.locator('[id="pcp-number"]');
    this.pcpNumberErrorText = page.locator('[id="pcp-number-helper-text"]');

    // Photo ID & Patient condition locators
    this.clearImage = page.getByRole('button', { name: 'Clear' });
    this.photoIdFrontImage = page.locator('#photo-id-front-description');
    this.photoIdBackImage = page.locator('#photo-id-back-description');
    this.photoPatientCondition = page.locator('#patient-photos-description');

    // Paperwork errors locators
    this.paperworkSelectOptionFieldErrorMessage = page.getByText(
      'Please fix the error in the "Select option" field to proceed'
    );
    this.paperworkErrorInFieldAboveMessage = page.getByText('Please fix the error in the field above to proceed');

    // Paperwork Telemed locators
    this.itemAddedValue = page.getByTestId(dataTestIds.itemAddedValue);

    // Current medications locators
    this.currentMedicationsPresent = this.getInputByValue(CURRENT_MEDICATIONS_PRESENT_LABEL);
    this.currentMedicationsAbsent = this.getInputByValue(CURRENT_MEDICATIONS_ABSENT_LABEL);

    // Known allergies locators
    this.knownAllergiesPresent = this.getInputByValue(KNOWN_ALLERGIES_PRESENT_LABEL);
    this.knownAllergiesAbsent = this.getInputByValue(KNOWN_ALLERGIES_ABSENT_LABEL);

    // Medical conditions locators
    this.medicalConditionsPresent = this.getInputByValue(MEDICAL_CONDITIONS_PRESENT_LABEL);
    this.medicalConditionsAbsent = this.getInputByValue(MEDICAL_CONDITIONS_ABSENT_LABEL);

    // Surgical history locators
    this.surgicalHistoryPresent = this.getInputByValue(SURGICAL_HISTORY_PRESENT_LABEL);
    this.surgicalHistoryAbsent = this.getInputByValue(SURGICAL_HISTORY_ABSENT_LABEL);

    // Additional questions locators
    this.covidSymptoms = (flag) => page.locator(`div[aria-labelledby='covid-symptoms-label'] input[value='${flag}']`);
    this.testedPositiveCovid = (flag) =>
      page.locator(`div[aria-labelledby='tested-positive-covid-label'] input[value='${flag}']`);
    this.travelUSA = (flag) => page.locator(`div[aria-labelledby='travel-usa-label'] input[value='${flag}']`);

    // School/work notes
    this.neitherNotes = page.getByText('Neither', { exact: true });
    this.schoolOnlyNotes = page.getByText('School only', { exact: true });
    this.workOnlyNotes = page.getByText('Work only', { exact: true });
    this.schoolAndWorkNotes = page.getByText('Both school and work notes', { exact: true });
    this.templatesBlock = page.locator('#group-wrapper-default');
    this.uploadSchoolTemplate = page.locator("[id='school-work-note-template-upload-group.item.0']");
    this.uploadWorkTemplate = page.locator("[id='school-work-note-template-upload-group.item.1']");
    this.schoolTemplateLabel = page.locator('#school-work-note-template-school-label');
    this.workTemplateLabel = page.locator('#school-work-note-template-work-label');
    this.removeFile = page.getByTestId('DeleteForeverIcon');
    this.schoolNoteFile = page.getByText('school-work-note-template-school.pdf');
    this.workNoteFile = page.getByText('school-work-note-template-work.pdf');

    // Paperwork - Invite participant
    this.inviteParticipantYes = page.getByText('Yes, I will add invite details below');
    this.inviteeFirstName = page.locator("[id='invite-first']");
    this.inviteeLastName = page.locator("[id='invite-last']");
    this.inviteeFirstName = page.locator("[id='invite-first']");
    this.inviteeEmail = page.locator("[id='invite-email']");
    this.inviteePhone = page.locator("[id='invite-phone']");
    this.inviteeContactEmail = page.locator(`input[value='Email' i]`);
    this.inviteeContactPhone = page.locator(`input[value='Phone' i]`);

    // Paperwork - Review and Submit locators
    this.finishButton = page.getByRole('button', { name: 'Finish' });
    this.patientNamePaperworkReviewScreen = page.getByTestId(dataTestIds.patientNamePaperworkReviewScreen);
    this.locationNamePaperworkReviewScreen = page.getByTestId(dataTestIds.locationNamePaperworkReviewScreen);
    this.checkInTimePaperworkReviewScreen = page.getByTestId(dataTestIds.checkInTimePaperworkReviewScreen);
    this.contactInformationEditButton = page.getByTestId('contact-information-page-edit');
    this.patientDetailsEditButton = page.getByTestId('patient-details-page-edit');
    this.pcpEditButton = page.getByTestId('primary-care-physician-page-edit');
    this.insuranceDetailsEditButton = page.getByTestId('payment-option-page-edit');
    this.responsiblePartyEditButton = page.getByTestId('responsible-party-page-edit');
    this.photoIdEditButton = page.getByTestId('photo-id-page-edit');
    this.consentFormsEditButton = page.getByTestId('consent-forms-page-edit');
    this.contactInformationChipStatus = page.locator('[data-testid="contact-information-page-status"] div');
    this.patientDetailsChipStatus = page.locator('[data-testid="patient-details-page-status"] div');
    this.pcpChipStatus = page.locator('[data-testid="primary-care-physician-page-status"] div');
    this.insuranceDetailsChipStatus = page.locator('[data-testid="payment-option-page-status"] div');
    this.responsiblePartyChipStatus = page.locator('[data-testid="responsible-party-page-status"] div');
    this.photoIdChipStatus = page.locator('[data-testid="photo-id-page-status"] div');
    this.consentFormsChipStatus = page.locator('[data-testid="consent-forms-page-status"] div');

    // Paperwork Telemed - Review and Submit locators
    this.currentMedicationsEditButton = page.getByTestId('current-medications-page-edit');
    this.currentAllergiesEditButton = page.getByTestId('allergies-page-edit');
    this.medicalHistoryEditButton = page.getByTestId('medical-history-page-edit');
    this.surgicalHistoryEditButton = page.getByTestId('surgical-history-page-edit');
    this.additionalQuestionsEditButton = page.getByTestId('additional-page-edit');
    this.patientConditionEditButton = page.getByTestId('patient-condition-page-edit');
    this.schoolWorkNotesEditButton = page.getByTestId('school-work-note-page-edit');
    this.inviteParticipantEditButton = page.getByTestId('invite-participant-page-edit');
    this.currentMedicationsChipStatus = page.locator('[data-testid="current-medications-page-status"] div');
    this.currentAllergiesChipStatus = page.locator('[data-testid="allergies-page-status"] div');
    this.medicalHistoryChipStatus = page.locator('[data-testid="medical-history-page-status"] div');
    this.surgicalHistoryChipStatus = page.locator('[data-testid="surgical-history-page-status"] div');
    this.additionalQuestionsChipStatus = page.locator('[data-testid="additional-page-status"] div');
    this.patientConditionChipStatus = page.locator('[data-testid="patient-condition-page-status"] div');
    this.schoolWorkNotesChipStatus = page.locator('[data-testid="school-work-note-page-status"] div');
    this.inviteParticipantChipStatus = page.locator('[data-testid="invite-participant-page-status"] div');

    // Waiting room
    this.manageParticipant = page.getByText('Manage participants');
    this.leaveWaitingRoom = page.getByText('Leave waiting room');
    this.cancelVisit = page.getByText('Cancel visit');
    this.modalInviteParticipantTitle = page.getByText('Invite participant');
    this.modalManageParticipantsTitle = page.locator('h2', { hasText: 'Manage participants' });
    this.sendInvite = page.getByRole('button', { name: 'Send invite' });
    this.inviteeList = page.getByTestId('manage-participants');
    this.wrInviteeName = page.getByTestId(dataTestIds.wrInviteeName);
    this.wrInviteeContact = page.getByTestId(dataTestIds.wrInviteeContact);
    this.cancelInvite = page.getByRole('button', { name: 'Cancel invite' });
    this.keepInvite = page.getByRole('button', { name: 'Keep invite' });
    this.wrInviteePhoneNumber = page.locator("[id='phoneNumber']");
    this.wrInviteeEmail = page.locator("[id='email']");
    this.wrInviteeFirstName = page.locator("[id='firstName']");
    this.wrInviteeLastName = page.locator("[id='lastName']");
  }

  private getInputByValue(value: string): Locator {
    return this.page.locator(`input[value='${value}']`);
  }

  async waitUntilLoadingIsFinished(): Promise<void> {
    await this.page.getByText('Loading...').waitFor({ state: 'hidden' });
  }

  async continueOrDifferentFamilyMember(): Promise<void> {
    (await this.differentFamilyMember.isEnabled())
      ? await this.selectDifferentFamilyMember()
      : await this.clickContinueButton();
  }
  async selectDifferentFamilyMember(): Promise<void> {
    await this.differentFamilyMember.click({ force: true });
  }
  async clickContinueButton(awaitNavigation = false): Promise<unknown> {
    await expect(this.continueButton).toBeEnabled();
    const currentPath = new URL(this.page.url()).pathname;
    if (awaitNavigation) {
      return await Promise.all([
        this.page.waitForURL((url) => url.pathname !== currentPath),
        this.continueButton.click(),
      ]);
    } else {
      return await this.continueButton.click();
    }
  }
  async clickBackButton(): Promise<void> {
    await this.backButton.click();
  }
  async clickReserveButton(): Promise<void> {
    await this.reserveButton.click();
  }
}
