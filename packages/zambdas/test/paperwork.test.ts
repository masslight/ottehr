import Oystehr from '@oystehr/sdk';
import { Account, Consent, Coverage, RelatedPerson } from 'fhir/r4b';
import { vi } from 'vitest';
import { getAuth0Token } from '../src/shared';
import { SECRETS } from './data/secrets';

export const insuranceData = {
  additionalInfo: '',
  relationship: 'parent',
  sex: 'female',
  dateOfBirth: '08/01/2023',
  lastName: 'test',
  firstName: 'test',
  insuranceType: 'ppo',
  memberId: '11200000',
  insurance: 'Fidelis Care',
};

export const formsData = {
  relationship: 'Self',
  fullName: 'james',
  signature: 'james',
  consentToTreat: 'true',
  HIPAA: 'true',
};

export const patientData = {
  reasonForVisit: ['OCD'],
  race: 'Asian',
  ethnicity: 'Hispanic or Latino',
  sex: 'male',
  dateOfBirth: '2023-08-08',
  lastName: 'test',
  firstName: 'test',
  newPatient: true,
};

export const insuranceTypeData = 'insurance';

export const responsiblePartyInfoData = {
  phoneNumber: '',
  birthSex: 'male',
  dateOfBirth: '08/01/2023',
  lastName: 'test',
  firstName: 'test',
  relationship: 'Self',
};

export const appointment = 'f21ad419-d8ab-4a41-8dbd-2e2e3a7b4333';
export const DEFAULT_TEST_TIMEOUT = 100000;

describe.skip('paperwork tests', () => {
  let oystehr: Oystehr | null = null;
  let token = null;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });
  beforeAll(async () => {
    const { FHIR_API, AUTH0_ENDPOINT, AUTH0_AUDIENCE, AUTH0_CLIENT, AUTH0_SECRET, PROJECT_API } = SECRETS;

    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({ accessToken: token, fhirApiUrl: FHIR_API, projectApiUrl: PROJECT_API });
  });

  function updatePaperwork(body?: any): Promise<any> {
    if (!oystehr) {
      throw new Error('zambdaClient is not defined');
    }
    return oystehr.zambda.execute({ id: 'update-paperwork', ...body });
  }

  test('Create paperwork as a new patient under the insurance payment option, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const response = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: insuranceTypeData,
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(response.message).toEqual('Successfully updated paperwork');

    const insuranceCoverageResource: Coverage = await oystehr.fhir.get({
      resourceType: 'Coverage',
      id: response?.insurance?.id,
    });

    const cardHolderDetailsResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.cardHolderInfo?.id,
    });

    const responsiblePartyResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.relatedPerson?.id,
    });

    const formsConsentResource: Consent = await oystehr.fhir.get({
      resourceType: 'Consent',
      id: response?.consentForm?.id,
    });

    if (!insuranceCoverageResource) {
      throw new Error('Insurance coverage not found!');
    }

    if (!cardHolderDetailsResource) {
      throw new Error('Card holder details not found!');
    }

    if (!responsiblePartyResource) {
      throw new Error('Responsible Party not found!');
    }

    if (!formsConsentResource) {
      throw new Error('Forms Consent informaton not found!');
    }
    expect(response.message).toEqual('Successfully updated paperwork');
    expect(response?.insurance).toEqual(insuranceCoverageResource);
    expect(response?.cardHolderInfo).toEqual(cardHolderDetailsResource);
    expect(response?.relatedPerson).toEqual(responsiblePartyResource);
    expect(response?.consentForm).toEqual(formsConsentResource);
  });

  test('Create paperwork as a returning patient under the insurance payment option, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const response = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: insuranceTypeData,
      responsibleParty: responsiblePartyInfoData,
      patient: {
        reasonForVisit: ['OCD'],
        race: 'Asian',
        ethnicity: 'Hispanic or Latino',
        sex: 'male',
        dateOfBirth: '2023-08-08',
        lastName: 'test',
        firstName: 'test',
        newPatient: false,
      },
      appointmentID: appointment,
    });

    expect(response.message).toEqual('Successfully updated paperwork');

    const insuranceCoverageResource: Coverage = await oystehr.fhir.get({
      resourceType: 'Coverage',
      id: response?.insurance?.id,
    });

    const cardHolderDetailsResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.cardHolderInfo?.id,
    });

    const responsiblePartyResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.relatedPerson?.id,
    });

    const formsConsentResource: Consent = await oystehr.fhir.get({
      resourceType: 'Consent',
      id: response?.consentForm?.id,
    });

    if (!insuranceCoverageResource) {
      throw new Error('Insurance coverage not found!');
    }

    if (!cardHolderDetailsResource) {
      throw new Error('Card holder details not found!');
    }

    if (!responsiblePartyResource) {
      throw new Error('Responsible Party not found!');
    }

    if (!formsConsentResource) {
      throw new Error('Forms Consent informaton not found!');
    }

    expect(response.message).toEqual('Successfully updated paperwork');
    expect(response?.insurance).toEqual(insuranceCoverageResource);
    expect(response?.cardHolderInfo).toEqual(cardHolderDetailsResource);
    expect(response?.relatedPerson).toEqual(responsiblePartyResource);
    expect(response?.consentForm).toEqual(formsConsentResource);
  });

  test('Create paperwork as a new patient under the self-pay payment option, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const response = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: 'self-pay',
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(response.message).toEqual('Successfully updated paperwork');

    const accountResource: Account = await oystehr.fhir.get({
      resourceType: 'Account',
      id: response?.account?.id,
    });

    if (!accountResource) {
      throw new Error('Account not found!');
    }
    expect(response.message).toEqual('Successfully updated paperwork');
    expect(response?.account).toEqual(accountResource);
  });

  test('Create paperwork and then update the paperwork under the insurance payment option, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const response = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: insuranceTypeData,
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(response.message).toEqual('Successfully updated paperwork');

    const insuranceCoverageResource: Coverage = await oystehr.fhir.get({
      resourceType: 'Coverage',
      id: response?.insurance?.id,
    });

    const cardHolderDetailsResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.cardHolderInfo?.id,
    });

    const responsiblePartyResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.relatedPerson?.id,
    });

    const formsConsentResource: Consent = await oystehr.fhir.get({
      resourceType: 'Consent',
      id: response?.consentForm?.id,
    });

    if (!insuranceCoverageResource) {
      throw new Error('Insurance coverage not found!');
    }

    if (!cardHolderDetailsResource) {
      throw new Error('Card holder details not found!');
    }

    if (!responsiblePartyResource) {
      throw new Error('Responsible Party not found!');
    }

    if (!formsConsentResource) {
      throw new Error('Forms Consent informaton not found!');
    }
    expect(response.message).toEqual('Successfully updated paperwork');
    expect(response?.insurance).toEqual(insuranceCoverageResource);
    expect(response?.cardHolderInfo).toEqual(cardHolderDetailsResource);
    expect(response?.relatedPerson).toEqual(responsiblePartyResource);
    expect(response?.consentForm).toEqual(formsConsentResource);

    const updateResponse = await updatePaperwork({
      forms: formsData,
      insurance: {
        additionalInfo: '',
        relationship: 'parent',
        sex: 'male',
        dateOfBirth: '08/01/2023',
        lastName: 'doe',
        firstName: 'john',
        insuranceType: 'ppo',
        memberId: '11200000',
        insurance: 'Fidelis Care',
      },
      insuranceType: insuranceTypeData,
      responsibleParty: responsiblePartyInfoData,
      patient: {
        reasonForVisit: ['OCD'],
        race: 'Asian',
        ethnicity: 'Hispanic or Latino',
        sex: 'male',
        dateOfBirth: '2023-08-08',
        lastName: 'test',
        firstName: 'test',
        newPatient: false,
      },
      appointmentID: appointment,
    });

    expect(updateResponse.message).toEqual('Successfully updated paperwork');

    const updatedInsuranceCoverageResource: Coverage = await oystehr.fhir.get({
      resourceType: 'Coverage',
      id: response?.insurance?.id,
    });

    if (!updatedInsuranceCoverageResource) {
      throw new Error('Insurance coverage not found!');
    }
    console.log(updateResponse);
    expect(updateResponse?.cardHolderInfo?.name?.[0]?.given?.[0]).toEqual('john');
    expect(updateResponse?.cardHolderInfo?.name?.[0]?.family).toEqual('doe');
    expect(updateResponse?.cardHolderInfo?.gender).toEqual('male');
  });

  test('Create paperwork and then update the paperwork under the self-pay payment option, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const response = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: 'self-pay',
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(response.message).toEqual('Successfully updated paperwork');

    const accountResource: Account = await oystehr.fhir.get({
      resourceType: 'Account',
      id: response?.account?.id,
    });

    if (!accountResource) {
      throw new Error('Account not found!');
    }

    expect(response?.account).toEqual(accountResource);

    const updatedResponse = await updatePaperwork({
      forms: formsData,
      insurance: {
        additionalInfo: '',
        relationship: 'parent',
        sex: 'male',
        dateOfBirth: '08/01/2023',
        lastName: 'doe',
        firstName: 'john',
        insuranceType: 'ppo',
        memberId: '11200000',
        insurance: 'Fidelis Care',
      },
      insuranceType: 'self-pay',
      responsibleParty: responsiblePartyInfoData,
      patient: {
        reasonForVisit: ['OCD'],
        race: 'Asian',
        ethnicity: 'Hispanic or Latino',
        sex: 'male',
        dateOfBirth: '2023-08-08',
        lastName: 'test',
        firstName: 'test',
        newPatient: false,
      },
      appointmentID: appointment,
    });

    expect(updatedResponse.message).toEqual('Successfully updated paperwork');

    const updatedAccountResource: Account = await oystehr.fhir.get({
      resourceType: 'Account',
      id: updatedResponse?.account?.id,
    });

    if (!updatedAccountResource) {
      throw new Error('Account not found!');
    }
    expect(updatedResponse?.account).toEqual(updatedAccountResource);
  });

  test('Create paperwork under insurance option and then update the paperwork under the self-pay payment option, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const response = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: insuranceTypeData,
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(response.message).toEqual('Successfully updated paperwork');

    const insuranceCoverageResource: Coverage = await oystehr.fhir.get({
      resourceType: 'Coverage',
      id: response?.insurance?.id,
    });

    const cardHolderDetailsResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.cardHolderInfo?.id,
    });

    const responsiblePartyResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: response?.relatedPerson?.id,
    });

    const formsConsentResource: Consent = await oystehr.fhir.get({
      resourceType: 'Consent',
      id: response?.consentForm?.id,
    });

    if (!insuranceCoverageResource) {
      throw new Error('Insurance coverage not found!');
    }

    if (!cardHolderDetailsResource) {
      throw new Error('Card holder details not found!');
    }

    if (!responsiblePartyResource) {
      throw new Error('Responsible Party not found!');
    }

    if (!formsConsentResource) {
      throw new Error('Forms Consent informaton not found!');
    }
    expect(response.message).toEqual('Successfully updated paperwork');
    expect(response?.insurance).toEqual(insuranceCoverageResource);
    expect(response?.cardHolderInfo).toEqual(cardHolderDetailsResource);
    expect(response?.relatedPerson).toEqual(responsiblePartyResource);
    expect(response?.consentForm).toEqual(formsConsentResource);

    const updatedResponse = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: 'self-pay',
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(updatedResponse.message).toEqual('Successfully updated paperwork');

    const updatedAccountResource: Account = await oystehr.fhir.get({
      resourceType: 'Account',
      id: updatedResponse?.account?.id,
    });

    if (!updatedAccountResource) {
      throw new Error('Account not found!');
    }
    expect(updatedResponse?.account).toEqual(updatedAccountResource);
  });

  test('Create paperwork under self-pay option and then update the paperwork under the insurance payment option, success', async () => {
    if (!oystehr) {
      throw new Error('oystehr is not defined');
    }

    const response = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: 'self-pay',
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(response.message).toEqual('Successfully updated paperwork');

    const updatedAccountResource: Account = await oystehr.fhir.get({
      resourceType: 'Account',
      id: response?.account?.id,
    });

    if (!updatedAccountResource) {
      throw new Error('Account not found!');
    }
    expect(response?.account).toEqual(updatedAccountResource);

    const updatedResponse = await updatePaperwork({
      forms: formsData,
      insurance: insuranceData,
      insuranceType: insuranceTypeData,
      responsibleParty: responsiblePartyInfoData,
      patient: patientData,
      appointmentID: appointment,
    });

    expect(updatedResponse.message).toEqual('Successfully updated paperwork');

    const insuranceCoverageResource: Coverage = await oystehr.fhir.get({
      resourceType: 'Coverage',
      id: updatedResponse?.insurance?.id,
    });

    const cardHolderDetailsResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: updatedResponse?.cardHolderInfo?.id,
    });

    const responsiblePartyResource: RelatedPerson = await oystehr.fhir.get({
      resourceType: 'RelatedPerson',
      id: updatedResponse?.relatedPerson?.id,
    });

    const formsConsentResource: Consent = await oystehr.fhir.get({
      resourceType: 'Consent',
      id: updatedResponse?.consentForm?.id,
    });

    if (!insuranceCoverageResource) {
      throw new Error('Insurance coverage not found!');
    }

    if (!cardHolderDetailsResource) {
      throw new Error('Card holder details not found!');
    }

    if (!responsiblePartyResource) {
      throw new Error('Responsible Party not found!');
    }

    if (!formsConsentResource) {
      throw new Error('Forms Consent informaton not found!');
    }
    expect(updatedResponse.message).toEqual('Successfully updated paperwork');
    expect(updatedResponse?.insurance).toEqual(insuranceCoverageResource);
    expect(updatedResponse?.cardHolderInfo).toEqual(cardHolderDetailsResource);
    expect(updatedResponse?.relatedPerson).toEqual(responsiblePartyResource);
    expect(updatedResponse?.consentForm).toEqual(formsConsentResource);
  });
});
