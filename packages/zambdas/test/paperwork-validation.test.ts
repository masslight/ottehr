import Oystehr from '@oystehr/sdk';
import { PersonSex } from 'utils';
import { vi } from 'vitest';
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
  birthSex: '',
  dateOfBirth: '08/01/2023',
  lastName: 'test',
  firstName: 'test',
  relationship: 'Self',
};

export const appointment = 'f21ad419-d8ab-4a41-8dbd-2e2e3a7b4333';
export const DEFAULT_TEST_TIMEOUT = 100000;

describe.skip('paperwork validation tests', () => {
  let oystehr: Oystehr | null = null;
  const incompletePatientError =
    'These fields are required: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.ethnicity", "patient.race", "patient.reasonForVisit"';
  const incompleteInsuranceError = `When insuranceType is not self-pay, these fields are required: "insurance.firstName", "insurance.lastName", "insurance.dateOfBirth", "insurance.sex". insurance.relationship", "insurance.insuranceType", "insurance.insurance", "insurance.memberId"`;

  const incompleteFormsError = `These fields are required: "forms.fullName", "forms.HIPAA", "forms.consentToTreat", "forms.signature", "forms.relationship"`;

  // const incompleteReponsiblePartyError = `These fields are required: "responsiblePartyInfo.relationship", "responsiblePartyInfo.firstName", "responsiblePartyInfo.lastName", "responsiblePartyInfo.dateOfBirth"`;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });
  beforeAll(async () => {
    // token = await getAuth0Token({
    //   AUTH0_ENDPOINT: AUTH0_ENDPOINT,
    //   AUTH0_CLIENT: AUTH0_CLIENT,
    //   AUTH0_SECRET: AUTH0_SECRET,
    //   AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    // });
    const { PROJECT_API } = SECRETS;
    oystehr = new Oystehr({ projectApiUrl: PROJECT_API });
  });

  function editPaperwork(body?: any): Promise<any> {
    if (!oystehr) {
      throw new Error('zambdaClient is not defined');
    }
    return oystehr.zambda.execute({ id: 'update-paperwork', ...body });
  }

  test('Edit paperwork without a body, fail', async () => {
    await expect(editPaperwork()).rejects.toEqual({
      error: 'No request body provided',
    });
  });

  test('Edit paperwork with an empty body, fail', async () => {
    await expect(editPaperwork({})).rejects.toEqual({
      error:
        'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork with incomplete patient date in request body, fail', async () => {
    await expect(
      editPaperwork({
        forms: formsData,
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        patient: {
          reasonForVisit: ['OCD'],
          race: '',
          ethnicity: 'Hispanic or Latino',
          sex: 'male',
          dateOfBirth: '2023-08-08',
          lastName: 'test',
          newPatient: true,
        },
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: incompletePatientError,
    });
  });

  test('Edit paperwork with missing responsiblePartyInfo in request body, fail', async () => {
    await expect(
      editPaperwork({
        forms: formsData,
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        patient: patientData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error:
        'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork with incomplete responsible party data in request body, fail', async () => {
    await expect(
      editPaperwork({
        forms: formsData,
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        patient: patientData,
        appointmentID: appointment,
        responsibleParty: {
          phoneNumber: '',
          birthSex: '',
          dateOfBirth: '08/01/2023',
          relationship: 'Self',
        },
      })
    ).rejects.toEqual({
      error:
        'These fields are required: "responsibleParty.relationship", "responsibleParty.firstName", "responsibleParty.lastName", "responsibleParty.dateOfBirth"',
    });
  });

  test('Edit paperwork with incomplete insurance data in request body, fail', async () => {
    await expect(
      editPaperwork({
        forms: formsData,
        insurance: {
          additionalInfo: '',
          relationship: 'parent',
          sex: 'female',
          dateOfBirth: '08/01/2023',
          firstName: '',
          insuranceType: 'ppo',
          insurance: 'Fidelis Care',
        },
        insuranceType: insuranceTypeData,
        patient: patientData,
        appointmentID: appointment,
        responsibleParty: responsiblePartyInfoData,
      })
    ).rejects.toEqual({
      error: incompleteInsuranceError,
    });
  });

  test('Edit paperwork with missing appointmentID in request body, fail', async () => {
    await expect(
      editPaperwork({
        forms: formsData,
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
      })
    ).rejects.toEqual({
      error:
        'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork with incomplete forms data in request body, fail', async () => {
    await expect(
      editPaperwork({
        forms: {
          relationship: 'Self',
          fullName: 'james',
          signature: 'james',
        },
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: incompleteFormsError,
    });
  });

  test('Edit paperwork with appointmentID as empty string in request body, fail', async () => {
    await expect(
      editPaperwork({
        forms: formsData,
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: '',
      })
    ).rejects.toEqual({
      error: `"appointmentID" cannot be an empty string`,
    });
  });

  test('Edit paperwork with missing forms in request body, fail', async () => {
    await expect(
      editPaperwork({
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error:
        'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork with missing insurance type in request body, fail', async () => {
    await expect(
      editPaperwork({
        insurance: insuranceData,
        forms: formsData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error:
        'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork with missing patient in request body, fail', async () => {
    await expect(
      editPaperwork({
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        forms: formsData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error:
        'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork with incorrect patient sex for patient object in request body, fail', async () => {
    await expect(
      editPaperwork({
        insurance: insuranceData,
        insuranceType: insuranceTypeData,
        forms: formsData,
        patient: {
          reasonForVisit: ['OCD'],
          race: 'Asian',
          ethnicity: 'Hispanic or Latino',
          sex: 'NA',
          dateOfBirth: '2023-08-08',
          lastName: 'test',
          firstName: 'test',
          newPatient: true,
        },
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: `"patient.sex" must be one of the following values: ${JSON.stringify(Object.values(PersonSex))}`,
    });
  });

  test('Edit paperwork with missing insurance in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: insuranceTypeData,
        forms: formsData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error:
        'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork with malformed date in insurance in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: insuranceTypeData,
        forms: formsData,
        insurance: {
          additionalInfo: '',
          relationship: 'parent',
          sex: 'female',
          dateOfBirth: '08/01/1023',
          lastName: 'test',
          firstName: 'test',
          insuranceType: 'ppo',
          memberId: '11200000',
          insurance: 'Fidelis Care',
        },
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: '"insurance.dateOfBirth" was not read as a valid date',
    });
  });

  test('Edit paperwork with no signature in forms in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: insuranceTypeData,
        forms: {
          relationship: 'Self',
          fullName: 'james',
          signature: '',
          consentToTreat: 'true',
          HIPAA: 'true',
        },
        insurance: insuranceData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: `"forms.signature" cannot be an empty string`,
    });
  });

  test('Edit paperwork when insurance type is not self-pay but missing information in insurance field in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: insuranceTypeData,
        forms: formsData,
        insurance: {
          additionalInfo: '',
          relationship: 'parent',
          sex: 'female',
          dateOfBirth: '08/01/2023',
          lastName: 'test',
          firstName: 'test',
          insuranceType: 'ppo',
          insurance: 'Fidelis Care',
        },
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: `When insuranceType is not self-pay, these fields are required: "insurance.firstName", "insurance.lastName", "insurance.dateOfBirth", "insurance.sex". insurance.relationship", "insurance.insuranceType", "insurance.insurance", "insurance.memberId"`,
    });
  });

  test('Edit paperwork when insurance type is self-pay but information in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: 'self-pay',
        patient: patientData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: 'These fields are required: "patient", "insuranceType", "forms", "appointmentID"',
    });
  });

  test('Edit paperwork when insurance type is not self-pay but missing information in insurance field in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: insuranceTypeData,
        forms: formsData,
        insurance: {
          additionalInfo: '',
          relationship: 'parent',
          sex: 'female',
          dateOfBirth: '08/01/2023',
          lastName: 'test',
          firstName: 'test',
          insuranceType: 'ppo',
          insurance: 'Fidelis Care',
        },
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: `When insuranceType is not self-pay, these fields are required: "insurance.firstName", "insurance.lastName", "insurance.dateOfBirth", "insurance.sex". insurance.relationship", "insurance.insuranceType", "insurance.insurance", "insurance.memberId"`,
    });
  });

  test('Edit paperwork when HIPAA and consent to treat agreement is not accepted for forms in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: insuranceTypeData,
        forms: {
          relationship: 'Self',
          fullName: 'james',
          signature: 'james',
          consentToTreat: 'false',
          HIPAA: 'false',
        },
        insurance: insuranceData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: `"forms.HIPAA" and "forms.consentToTreat" agreeement must be accepted`,
    });
  });

  // test('Edit paperwork when relationship is invalid for forms in request body, fail', async () => {
  //   await expect(
  //     editPaperwork({
  //       insuranceType: insuranceTypeData,
  //       forms: {
  //         relationship: 'TEST',
  //         fullName: 'james',
  //         signature: 'james',
  //         consentToTreat: 'true',
  //         HIPAA: 'true',
  //       },
  //       insurance: insuranceData,
  //       patient: patientData,
  //       responsibleParty: responsiblePartyInfoData,
  //       appointmentID: appointment,
  //     })
  //   ).rejects.toEqual({
  //     error: `"forms.relationship" must be one of the following values: ${JSON.stringify(
  //       Object.values(RelationshipToPatient)
  //     )}`,
  //   });
  // });

  test('Edit paperwork when insurance type is not self-pay or insurance in request body, fail', async () => {
    await expect(
      editPaperwork({
        insuranceType: 'neither',
        forms: formsData,
        insurance: insuranceData,
        patient: patientData,
        responsibleParty: responsiblePartyInfoData,
        appointmentID: appointment,
      })
    ).rejects.toEqual({
      error: '"insuranceType" must be either "self-pay" or "insurance"',
    });
  });

  // test('Edit paperwork when insurance provider is not within the eligible insurance providers in request body, fail', async () => {
  //   await expect(
  //     editPaperwork({
  //       insuranceType: insuranceTypeData,
  //       forms: formsData,
  //       insurance: {
  //         additionalInfo: '',
  //         relationship: 'parent',
  //         sex: 'female',
  //         dateOfBirth: '08/01/2023',
  //         lastName: 'test',
  //         firstName: 'test',
  //         insuranceType: 'test',
  //         memberId: '11200000',
  //         insurance: 'xxx',
  //       },
  //       patient: patientData,
  //       responsibleParty: responsiblePartyInfoData,
  //       appointmentID: appointment,
  //     })
  //   ).rejects.toEqual({
  //     error: `"insuranceType" must be one of the following values: ${JSON.stringify(Object.values(Insurance))}`,
  //   });
  // });
});
