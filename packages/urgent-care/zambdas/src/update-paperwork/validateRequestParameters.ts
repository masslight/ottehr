import { Questionnaire } from 'fhir/r4';
import { PaperworkResponse, UpdatePaperworkInput } from '.';
import { questionnaireItemToInputType } from '../get-paperwork';
import { emailRegex, phoneRegex, zipRegex } from '../shared';
import { dateRegex } from '../shared/validation';
import { ZambdaInput, parseFiletype } from 'utils';

function checkRequire(item: any, values: any): boolean {
  if (item.required && !item.requireWhen) {
    return true;
  }

  if (item.requireWhen) {
    const value = values[item.requireWhen.question];
    // console.log(item.name, item.requireWhen.answer, value);
    if (item.requireWhen.operator === '=') {
      return value === item.requireWhen.answer;
    }
  }

  return false;
}

function checkEnable(item: any, values: any): boolean {
  if (item.hidden && !item.enableWhen) {
    return false;
  }

  if (item.enableWhen) {
    const value = values[item.enableWhen.question];
    // console.log(item.name, item.enableWhen.answer, value);
    if (item.enableWhen.operator === '=') {
      const test = value === item.enableWhen.answer;
      if (!test) {
        item.hidden = true;
      }
      return test;
    }
  }

  return true;
}

export function validateUpdatePaperworkParams(input: ZambdaInput, questionnaire: Questionnaire): UpdatePaperworkInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const inputJSON = JSON.parse(input.body);
  const { appointmentID, paperwork, files } = inputJSON;

  const responses: PaperworkResponse[] = [];

  questionnaire.item?.forEach((pageTemp) => {
    const pageItems = pageTemp.item;
    pageItems?.forEach((itemTemp) => {
      const questionnaireItemInputTemp = questionnaireItemToInputType(itemTemp);
      if (questionnaireItemInputTemp.type === 'Description' || questionnaireItemInputTemp.type === 'Header 3') {
        return;
      }

      if (!checkEnable(questionnaireItemInputTemp, paperwork)) {
        return;
      }

      let paperworkItemValueTemp = null;
      if (
        questionnaireItemInputTemp.format === 'Email' ||
        questionnaireItemInputTemp.format === 'ZIP' ||
        questionnaireItemInputTemp.format === 'Phone Number'
      ) {
        paperworkItemValueTemp = paperwork[itemTemp.linkId].trim();
      } else {
        paperworkItemValueTemp = paperwork[itemTemp.linkId];
      }

      let responseType = 'text';
      const requireError = `Error: Missing required input ${itemTemp.linkId}`;

      /* NOTE: This conditional makes the patient-point-of-discovery field optional on the backend only.
               The required attribute of this field is still used on the frontend. */
      if (!paperworkItemValueTemp && questionnaireItemInputTemp.id === 'patient-point-of-discovery') {
        return;
      }

      if (!paperworkItemValueTemp && questionnaireItemInputTemp.required) {
        throw new Error(requireError);
      }

      if (!paperworkItemValueTemp && checkRequire(questionnaireItemInputTemp, paperwork)) {
        throw new Error(requireError);
      }

      if (
        !questionnaireItemInputTemp.required &&
        (paperworkItemValueTemp === '' || paperworkItemValueTemp === undefined)
      ) {
        return;
      }

      if (questionnaireItemInputTemp.format === 'ZIP' && !zipRegex.test(paperworkItemValueTemp)) {
        throw new Error(
          `Error: Input ${itemTemp.linkId} with value "${paperworkItemValueTemp}" may not be a valid ZIP code`,
        );
      }

      if (questionnaireItemInputTemp.format === 'Phone Number' && !phoneRegex.test(paperworkItemValueTemp)) {
        throw new Error(
          `Error: Input ${itemTemp.linkId} with value "${paperworkItemValueTemp}" may not be a valid phone number`,
        );
      }

      if (questionnaireItemInputTemp.format === 'Email' && !emailRegex.test(paperworkItemValueTemp)) {
        throw new Error(
          `Error: Input ${itemTemp.linkId} with value "${paperworkItemValueTemp}" may not be a valid email`,
        );
      }

      if (itemTemp.type === 'choice') {
        const options = itemTemp.answerOption?.map((itemTemp) => itemTemp.valueString);
        if (!options?.includes(paperworkItemValueTemp)) {
          throw new Error(
            `Error: Input ${
              itemTemp.linkId
            } with value "${paperworkItemValueTemp}" is not in the accepted list of values ${JSON.stringify(options)}`,
          );
        }
      } else if (itemTemp.type === 'date') {
        if (!dateRegex.test(paperworkItemValueTemp)) {
          throw new Error(
            `Error: Input ${itemTemp.linkId} with value "${paperworkItemValueTemp}" may not be a valid date`,
          );
        }
        responseType = 'date';
      } else if (itemTemp.type === 'boolean') {
        const boolsThatMustBeTrue = ['hipaa-acknowledgement', 'consent-to-treat'];
        if (boolsThatMustBeTrue.includes(itemTemp.linkId) && paperworkItemValueTemp !== true) {
          throw new Error(`Error: Input ${itemTemp.linkId} value with value "${paperworkItemValueTemp}" must be true`);
        }
        responseType = 'boolean';
      }

      if (responseType === 'text') {
        paperworkItemValueTemp = paperwork[itemTemp.linkId].trim();
      }

      responses.push({
        linkId: itemTemp.linkId,
        response: paperworkItemValueTemp,
        type: responseType,
      });
    });
  });

  console.log(
    `isContactInformationComplete ${isContactInformationComplete(
      paperwork,
    )}\nisPatientDetailsComplete ${isPatientDetailsComplete(
      paperwork,
    )}\nisPaymentOptionComplete ${isPaymentOptionComplete(
      paperwork,
    )}\nisResponsiblePartyComplete ${isResponsiblePartyComplete(paperwork)}\nisPhotoIdComplete ${isPhotoIdComplete(
      files,
    )}\nisConsentFormsComplete ${isConsentFormsComplete(paperwork)}`,
  );
  const paperworkComplete =
    isContactInformationComplete(paperwork) &&
    isPatientDetailsComplete(paperwork) &&
    isPaymentOptionComplete(paperwork) &&
    isResponsiblePartyComplete(paperwork) &&
    isPhotoIdComplete(files) &&
    isConsentFormsComplete(paperwork);

  // Validate photo uploads file type. PDF only supports JPEG and PNG.
  const cardsArr = [
    files?.['insurance-card-front']?.z3Url,
    files?.['insurance-card-back']?.z3Url,
    files?.['id-front']?.z3Url,
    files?.['id-back']?.z3Url,
  ];

  cardsArr.forEach((cardUrl) => {
    const fileType = cardUrl && parseFiletype(cardUrl);
    if (fileType && fileType !== 'png' && fileType !== 'jpg' && fileType !== 'jpeg') {
      throw new Error('Unsupported file type. File type must be one of: "png", "jpg", "jpeg"');
    }
  });

  let ipAddress = '';
  const environment = process.env.ENVIRONMENT || input.secrets?.ENVIRONMENT;
  console.log('Environment: ', environment);
  switch (environment) {
    case 'local':
      ipAddress = input?.requestContext?.identity?.sourceIp ? input.requestContext.identity.sourceIp : 'Unknown';
      break;
    case 'dev':
    case 'testing':
    case 'staging':
    case 'production':
      ipAddress = input?.headers?.['cf-connecting-ip'] ? input.headers['cf-connecting-ip'] : 'Unknown';
      break;
    default:
      ipAddress = 'Unknown';
  }

  return {
    appointmentID,
    paperwork: responses,
    files,
    paperworkComplete,
    ipAddress,
  };
}

function valueExists(value: any): boolean {
  return value !== undefined && value !== '';
}

function isContactInformationComplete(paperwork: any): boolean {
  const address =
    valueExists(paperwork['patient-street-address']) &&
    valueExists(paperwork['patient-city']) &&
    valueExists(paperwork['patient-state']) &&
    valueExists(paperwork['patient-zip']);
  const patientFillingOutAs = valueExists(paperwork['patient-filling-out-as']);
  const patientInfoExists = valueExists(paperwork['patient-email']) && valueExists(paperwork['patient-number']);
  const guardianInfoExists = valueExists(paperwork['guardian-email']) && valueExists(paperwork['guardian-number']);

  return address && patientFillingOutAs && (patientInfoExists || guardianInfoExists);
}

function isPatientDetailsComplete(paperwork: any): boolean {
  const pointOfDiscovery = paperwork['patient-point-of-discovery'];
  const pointOfDiscoveryValid = pointOfDiscovery === undefined || pointOfDiscovery !== '';
  return pointOfDiscoveryValid && valueExists(paperwork['patient-birth-sex']);
}

function isPaymentOptionComplete(paperwork: any): boolean {
  const noInsurance = paperwork['payment-option'] === 'I will pay without insurance';
  const insurance =
    valueExists(paperwork['insurance-carrier']) &&
    valueExists(paperwork['insurance-member-id']) &&
    valueExists(paperwork['policy-holder-first-name']) &&
    valueExists(paperwork['policy-holder-last-name']) &&
    valueExists(paperwork['policy-holder-date-of-birth']) &&
    valueExists(paperwork['policy-holder-birth-sex']) &&
    valueExists(paperwork['patient-relationship-to-insured']);
  return noInsurance || insurance;
}

function isResponsiblePartyComplete(paperwork: any): boolean {
  return (
    valueExists(paperwork['responsible-party-relationship']) &&
    valueExists(paperwork['responsible-party-first-name']) &&
    valueExists(paperwork['responsible-party-last-name']) &&
    valueExists(paperwork['responsible-party-date-of-birth']) &&
    valueExists(paperwork['responsible-party-birth-sex'])
  );
}

function isPhotoIdComplete(files: any): boolean {
  return valueExists(files['id-front'].z3Url) && valueExists(files['id-back'].z3Url);
}

function isConsentFormsComplete(paperwork: any): boolean {
  return (
    paperwork['hipaa-acknowledgement'] === true &&
    paperwork['consent-to-treat'] === true &&
    valueExists(paperwork['signature']) &&
    valueExists(paperwork['full-name']) &&
    valueExists(paperwork['consent-form-signer-relationship'])
  );
}
