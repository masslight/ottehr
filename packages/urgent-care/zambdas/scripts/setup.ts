/* eslint-disable sort-keys */
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FhirClient } from '@zapehr/sdk';
import { Location, Organization, Questionnaire } from 'fhir/r4';

async function createApplication(
  projectApiUrl: string,
  applicationName: string,
  accessToken: string,
  projectId: string,
): Promise<[string, string]> {
  return new Promise(async (resolve, reject) => {
    console.log('building access policy');
    console.log('searching for exisiting roles for the project');
    const accessPolicy = {
      rule: [
        {
          resource: 'Zambda:Function:todo',
          action: ['Zambda:InvokeFunction'],
          effect: 'Allow',
        },
      ],
    };
    const existingRoles = await fetch(`${projectApiUrl}/iam/roles`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-zapehr-project-id': `${projectId}`,
      },
    });
    const rolesData = await existingRoles.json();
    console.log('existingRoles: ', rolesData);
    let patientRole;
    if (rolesData.length > 0) {
      patientRole = rolesData.find((role: any) => role.name === 'Patient');
    }
    if (patientRole) {
      console.log('patient role found: ', patientRole);
      const patientRoleRes = await fetch(`${projectApiUrl}/iam/roles/${patientRole.id}`, {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-zapehr-project-id': `${projectId}`,
        },
        body: JSON.stringify({ accessPolicy: accessPolicy }),
      });
      patientRole = await patientRoleRes.json();
      console.log('patientRole inlineAccessPolicy patch: ', patientRole);
    } else {
      console.log('creating patient role');
      const patientRoleRes = await fetch(`${projectApiUrl}/iam/roles`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-zapehr-project-id': `${projectId}`,
        },
        body: JSON.stringify({ name: 'Patient', accessPolicy: accessPolicy }),
      });
      patientRole = await patientRoleRes.json();
      console.log('patientRole: ', patientRole);
    }
    console.group('setting default patient role for project');
    const endpoint = `${projectApiUrl}/project`;
    console.log('sending to endpoint: ', endpoint);
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'x-zapehr-project-id': `${projectId}`,
      },
      body: JSON.stringify({ defaultPatientRoleId: patientRole.id, signupEnabled: true }),
    });

    const resData = await response.json();
    console.log('response json: ', resData);
    console.groupEnd();
    if (response.status === 200) {
      console.log('successfully updated default patient role');
    } else {
      throw new Error('Failed to update default patient role');
    }

    fetch(`${projectApiUrl}/application`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-zapehr-project-id': `${projectId}`,
      },
      method: 'POST',
      body: JSON.stringify({
        name: applicationName,
        description: 'Intake application with sms authentication',
        loginRedirectUri: 'https://127.0.0.1:3015/patients',
        allowedCallbackUrls: ['http://localhost:3015', 'http://localhost:3015/patients'],
        allowedLogoutUrls: ['http://localhost:3015'],
        allowedWebOriginsUrls: ['http://localhost:3015'],
        allowedCORSOriginsUrls: ['http://localhost:3015'],
        loginWithEmailEnabled: true,
        passwordlessSMS: true,
        mfaEnabled: false,
        shouldSendInviteEmail: false,
        logoUri:
          'https://assets-global.website-files.com/653fce065d76f84cf31488ae/65438838a5f9308ca9498887_otter%20logo%20dark.svg',
      }),
    })
      .then(async (response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          // console.log(await response.json());
          console.log(JSON.stringify(await response.json()));
          console.log(response.body);
          throw new Error(`Failed to create application. Status: ${response.status}`);
        }
      })
      .then((data) => resolve([data.id, data.clientId]))
      .catch((error) => reject(error));
  });
}

function createZambdaLocalEnvFile(
  projectId: string,
  m2mDeviceId: string,
  m2mClientId: string,
  m2mSecret: string,
  organizationId: string,
): string {
  const overrideData = {
    AUTH0_ENDPOINT: 'https://auth.zapehr.com/oauth/token',
    AUTH0_AUDIENCE: 'https://api.zapehr.com',
    AUTH0_CLIENT: m2mClientId,
    AUTH0_SECRET: m2mSecret,
    // todo use a different m2m for this
    MESSAGING_DEVICE_ID: m2mDeviceId,
    MESSAGING_M2M_CLIENT: m2mClientId,
    MESSAGING_M2M_SECRET: m2mSecret,
    FHIR_API: 'https://fhir-api.zapehr.com/r4',
    PROJECT_API: 'https://project-api.zapehr.com/v1',
    ORGANIZATION_ID: organizationId,
    PROJECT_ID: projectId,
  };

  const envFolderPath = 'packages/urgent-care/zambdas/.env';
  const envPath = path.join(envFolderPath, 'local.json');
  const envTemplatePath = path.join(envFolderPath, 'local.template.json');

  // Read the template file
  const templateData = JSON.parse(fs.readFileSync(envTemplatePath, 'utf8'));

  const envData = { ...templateData, ...overrideData };

  if (!fs.existsSync(envFolderPath)) {
    fs.mkdirSync(envFolderPath, { recursive: true });
  }
  fs.writeFileSync(envPath, JSON.stringify(envData, null, 2));
  return envPath;
}

function createAppLocalEnvFile(clientId: string): string {
  const envTemplatePath = 'packages/urgent-care/app/env/.env.local-template';
  const envPath = 'packages/urgent-care/app/env/.env.local';

  // Read the template file
  const templateData = fs.readFileSync(envTemplatePath, 'utf8');

  // Replace the placeholders with the actual values
  const updatedData = templateData.replace(
    'VITE_APP_APPLICATION_CLIENT_ID=placeholder_client_id',
    `VITE_APP_APPLICATION_CLIENT_ID=${clientId}`,
  );

  // Write the updated data to the new file
  fs.writeFileSync(envPath, updatedData);
  return envPath;
}

const createOrganization = async (fhirClient: FhirClient): Promise<Organization> => {
  const organization: Organization = {
    resourceType: 'Organization',
    active: true,
    name: 'Example Organization',
  };

  return await fhirClient.createResource(organization);
};

const createQuestionnaire = async (fhirClient: FhirClient) => {
  const newQuestionnaire: Questionnaire = {
    resourceType: 'Questionnaire',
    name: 'paperwork',
    status: 'draft',
    item: [
      {
        linkId: 'contact-information-page',
        text: 'Contact information',
        type: 'group',
        item: [
          {
            linkId: 'contact-page-caption',
            text: 'Completing the following forms will save time in our office and ensure a smooth check-in experience. Thanks for your cooperation!',
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'p',
              },
            ],
          },
          {
            linkId: 'contact-page-address-text',
            text: "{patientFirstName}'s primary address",
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'h3',
              },
            ],
          },
          {
            linkId: 'patient-street-address',
            text: 'Street address',
            type: 'string',
            required: true,
          },
          {
            linkId: 'patient-street-address-2',
            text: 'Address line 2 (optional)',
            type: 'string',
            required: false,
          },
          {
            linkId: 'patient-city',
            text: 'City',
            type: 'string',
            required: true,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 4,
              },
            ],
          },
          {
            linkId: 'patient-state',
            text: 'State',
            type: 'choice',
            answerOption: [
              {
                valueString: 'AL',
              },
              {
                valueString: 'AK',
              },
              {
                valueString: 'AZ',
              },
              {
                valueString: 'AR',
              },
              {
                valueString: 'CA',
              },
              {
                valueString: 'CO',
              },
              {
                valueString: 'CT',
              },
              {
                valueString: 'DE',
              },
              {
                valueString: 'DC',
              },
              {
                valueString: 'FL',
              },
              {
                valueString: 'GA',
              },
              {
                valueString: 'HI',
              },
              {
                valueString: 'ID',
              },
              {
                valueString: 'IL',
              },
              {
                valueString: 'IN',
              },
              {
                valueString: 'IA',
              },
              {
                valueString: 'KS',
              },
              {
                valueString: 'KY',
              },
              {
                valueString: 'LA',
              },
              {
                valueString: 'ME',
              },
              {
                valueString: 'MD',
              },
              {
                valueString: 'MA',
              },
              {
                valueString: 'MI',
              },
              {
                valueString: 'MN',
              },
              {
                valueString: 'MS',
              },
              {
                valueString: 'MO',
              },
              {
                valueString: 'MT',
              },
              {
                valueString: 'NE',
              },
              {
                valueString: 'NV',
              },
              {
                valueString: 'NH',
              },
              {
                valueString: 'NJ',
              },
              {
                valueString: 'NM',
              },
              {
                valueString: 'NY',
              },
              {
                valueString: 'NC',
              },
              {
                valueString: 'ND',
              },
              {
                valueString: 'OH',
              },
              {
                valueString: 'OK',
              },
              {
                valueString: 'OR',
              },
              {
                valueString: 'PA',
              },
              {
                valueString: 'RI',
              },
              {
                valueString: 'SC',
              },
              {
                valueString: 'SD',
              },
              {
                valueString: 'TN',
              },
              {
                valueString: 'TX',
              },
              {
                valueString: 'UT',
              },
              {
                valueString: 'VT',
              },
              {
                valueString: 'VA',
              },
              {
                valueString: 'VI',
              },
              {
                valueString: 'WA',
              },
              {
                valueString: 'WV',
              },
              {
                valueString: 'WI',
              },
              {
                valueString: 'WY',
              },
            ],
            required: true,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 4,
              },
            ],
          },
          {
            linkId: 'patient-zip',
            text: 'ZIP',
            type: 'string',
            required: true,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'ZIP',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 4,
              },
            ],
          },
          {
            linkId: 'patient-contact-additional-text',
            text: 'Additional information',
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'h3',
              },
            ],
          },
          {
            linkId: 'patient-contact-additional-caption',
            text: 'Please provide the information for the best point of contact regarding this reservation.',
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'p',
              },
            ],
          },
          {
            linkId: 'patient-filling-out-as',
            text: 'I am filling out this info as:',
            type: 'choice',
            answerOption: [
              {
                valueString: 'Parent/Guardian',
              },
              {
                valueString: 'Patient (Self)',
              },
            ],
            required: true,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/select-type',
                valueString: 'Radio List',
              },
            ],
          },
          {
            linkId: 'patient-email',
            text: 'Patient email',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Email',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
                extension: [
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                    valueString: 'patient-filling-out-as',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                    valueString: '=',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                    valueString: 'Patient (Self)',
                  },
                ],
              },
            ],
          },
          {
            linkId: 'patient-number',
            text: 'Patient mobile',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Phone Number',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
                extension: [
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                    valueString: 'patient-filling-out-as',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                    valueString: '=',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                    valueString: 'Patient (Self)',
                  },
                ],
              },
            ],
          },
          {
            linkId: 'guardian-email',
            text: 'Parent/Guardian email',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Email',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
                extension: [
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                    valueString: 'patient-filling-out-as',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                    valueString: '=',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                    valueString: 'Parent/Guardian',
                  },
                ],
              },
            ],
          },
          {
            linkId: 'guardian-number',
            text: 'Parent/Guardian mobile',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Phone Number',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when',
                extension: [
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-question',
                    valueString: 'patient-filling-out-as',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-operator',
                    valueString: '=',
                  },
                  {
                    url: 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when-answer',
                    valueString: 'Parent/Guardian',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        linkId: 'patient-details-page',
        text: 'Patient details',
        type: 'group',
        item: [
          {
            linkId: 'patient-ethnicity',
            text: "Patient's ethnicity",
            type: 'choice',
            required: false,
            answerOption: [
              {
                valueString: 'Hispanic or Latino',
              },
              {
                valueString: 'Not Hispanic or Latino',
              },
              {
                valueString: 'Decline to Specify',
              },
            ],
          },
          {
            linkId: 'patient-race',
            text: "Patient's race",
            type: 'choice',
            required: false,
            answerOption: [
              {
                valueString: 'American Indian or Alaska Native',
              },
              {
                valueString: 'Asian',
              },
              {
                valueString: 'Black or African American',
              },
              {
                valueString: 'Native Hawaiian or Other Pacific Islander',
              },
              {
                valueString: 'White',
              },
              {
                valueString: 'Decline to Specify',
              },
            ],
          },
          {
            linkId: 'patient-birth-sex',
            text: "Patient's birth sex",
            type: 'choice',
            required: true,
            answerOption: [
              {
                valueString: 'Male',
              },
              {
                valueString: 'Female',
              },
              {
                valueString: 'Intersex',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary',
                valueString:
                  'Our care team uses this to inform treatment recommendations and share helpful information regarding potential medication side effects, as necessary.',
              },
            ],
          },
          {
            linkId: 'patient-pronouns',
            text: 'Preferred pronouns',
            type: 'choice',
            required: false,
            answerOption: [
              {
                valueString: 'He/him',
              },
              {
                valueString: 'She/her',
              },
              {
                valueString: 'They/them',
              },
              {
                valueString: 'My pronouns are not listed',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text-secondary',
                valueString:
                  'Pronoun responses are kept confidential in our system and are used to help us best respect how our patients (up to age 26) wish to be addressed.',
              },
            ],
          },
          {
            linkId: 'patient-pronouns-custom',
            text: 'My pronouns',
            type: 'text',
            required: false,
            enableWhen: [
              {
                question: 'patient-pronouns',
                operator: '=',
                answerString: 'My pronouns are not listed',
              },
            ],
          },
          {
            linkId: 'physician-text',
            text: 'Primary Care Physician information',
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'h3',
              },
            ],
          },
          {
            linkId: 'pcp-first',
            text: 'PCP first name',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 6,
              },
            ],
          },
          {
            linkId: 'pcp-last',
            text: 'PCP last name',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 6,
              },
            ],
          },
          {
            linkId: 'pcp-number',
            text: 'PCP phone number',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Phone Number',
              },
            ],
          },
          {
            linkId: 'preferred-pharmarcy-text',
            text: 'Preferred pharmacy',
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'h3',
              },
            ],
          },
          {
            linkId: 'pharmacy-name',
            text: 'Pharmacy name',
            type: 'string',
          },
          {
            linkId: 'pharmacy-address',
            text: 'Pharmacy address',
            type: 'string',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/placeholder',
                valueString: 'Street, City, Zip Code',
              },
            ],
          },
          {
            linkId: 'pharmacy-phone',
            text: 'Pharmacy phone',
            type: 'string',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Phone Number',
              },
            ],
          },
          {
            linkId: 'point-of-discovery-additional-text',
            text: 'Additional information',
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'h3',
              },
            ],
          },
          {
            linkId: 'patient-point-of-discovery',
            text: 'How did you hear about us?',
            type: 'choice',
            required: true,
            answerOption: [
              {
                valueString: 'Friend/Family',
              },
              {
                valueString: 'Been there with another child or family member',
              },
              {
                valueString: 'Pediatrician/Healthcare Professional',
              },
              {
                valueString: 'Google/Internet search',
              },
              {
                valueString: 'Internet ad',
              },
              {
                valueString: 'Social media community group',
              },
              {
                valueString: 'Webinar',
              },
              {
                valueString: 'TV/Radio',
              },
              {
                valueString: 'Newsletter',
              },
              {
                valueString: 'School',
              },
              {
                valueString: 'Drive by/Signage',
              },
            ],
          },
        ],
      },
      {
        linkId: 'payment-option-page',
        text: 'How would you like to pay for your visit?',
        extension: [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/review-text',
            valueString: 'Insurance details',
          },
        ],
        type: 'group',
        item: [
          {
            linkId: 'payment-option',
            text: 'Select payment option',
            type: 'choice',
            required: true,
            answerOption: [
              {
                valueString: 'I have insurance',
              },
              {
                valueString: 'I will pay without insurance',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/select-type',
                valueString: 'Radio',
              },
            ],
          },
          {
            linkId: 'insurance-details-text',
            text: 'Insurance details',
            type: 'display',
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'h3',
              },
            ],
          },
          {
            linkId: 'insurance-details-caption',
            text: 'We use this information to help determine your coverage and costs.',
            type: 'display',
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'p',
              },
            ],
          },
          {
            linkId: 'insurance-carrier',
            text: 'Insurance Carrier',
            type: 'string',
            required: true,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
          },
          {
            linkId: 'insurance-member-id',
            text: 'Member ID',
            type: 'string',
            required: true,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
          },
          {
            linkId: 'cardholder-details-text',
            text: 'Cardholder details',
            type: 'display',
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'h3',
              },
            ],
          },
          {
            linkId: 'policy-holder-first-name',
            text: "Policy holder's first name",
            type: 'string',
            required: true,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 6,
              },
            ],
          },
          {
            linkId: 'policy-holder-last-name',
            text: "Policy holder's last name",
            type: 'string',
            required: true,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 6,
              },
            ],
          },
          {
            linkId: 'policy-holder-date-of-birth',
            text: "Policy holder's date of birth",
            type: 'date',
            required: true,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
          },
          {
            linkId: 'policy-holder-birth-sex',
            text: "Policy holder's birth sex",
            type: 'choice',
            required: true,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            answerOption: [
              {
                valueString: 'Male',
              },
              {
                valueString: 'Female',
              },
              {
                valueString: 'Intersex',
              },
            ],
          },
          {
            linkId: 'patient-relationship-to-insured',
            text: "Patient's relationship to insured",
            type: 'choice',
            required: true,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            answerOption: [
              {
                valueString: 'Child',
              },
              {
                valueString: 'Parent',
              },
              {
                valueString: 'Mother',
              },
              {
                valueString: 'Father',
              },
              {
                valueString: 'Sibling',
              },
              {
                valueString: 'Spouse',
              },
              {
                valueString: 'Other',
              },
            ],
          },
          {
            linkId: 'insurance-additional-information',
            text: 'Additional insurance information (optional)',
            type: 'text',
            required: false,
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-multiline-minimum-rows',
                valuePositiveInt: 3,
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/information-text',
                valueString: 'Secondary insurance or additional insurance details',
              },
            ],
          },
          {
            linkId: 'insurance-card-front',
            text: 'Front side of the insurance card (optional)',
            type: 'attachment',
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
                valueString: 'Take a picture of the **front side** of your card',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
                valueString: '64290-0',
              },
            ],
          },
          {
            linkId: 'insurance-card-back',
            text: 'Back side of the insurance card (optional)',
            type: 'attachment',
            enableWhen: [
              {
                question: 'payment-option',
                operator: '=',
                answerString: 'I have insurance',
              },
            ],
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
                valueString: 'Take a picture of the **back side** of your card',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
                valueString: '64290-0',
              },
            ],
          },
        ],
      },
      {
        linkId: 'responsible-party-page',
        text: 'Responsible party information',
        type: 'group',
        item: [
          {
            linkId: 'responsible-party-page-caption',
            text: "A responsible party is the individual responsible for the visit's financial obligations. If the patient is not their own responsible party (most common), then the responsible party must be the patient's legal guardian or legal designee.",
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'p',
              },
            ],
          },
          {
            linkId: 'responsible-party-relationship',
            text: 'Relationship',
            type: 'choice',
            required: true,
            answerOption: [
              {
                valueString: 'Self',
              },
              {
                valueString: 'Legal Guardian',
              },
              {
                valueString: 'Father',
              },
              {
                valueString: 'Mother',
              },
              {
                valueString: 'Spouse',
              },
            ],
          },
          {
            linkId: 'responsible-party-first-name',
            text: 'First name',
            type: 'string',
            required: true,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 6,
              },
            ],
          },
          {
            linkId: 'responsible-party-last-name',
            text: 'Last name',
            type: 'string',
            required: true,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-width',
                valuePositiveInt: 6,
              },
            ],
          },
          {
            linkId: 'responsible-party-date-of-birth',
            text: 'Date of birth',
            type: 'date',
            required: true,
          },
          {
            linkId: 'responsible-party-birth-sex',
            text: 'Birth sex',
            type: 'choice',
            required: true,
            answerOption: [
              {
                valueString: 'Male',
              },
              {
                valueString: 'Female',
              },
              {
                valueString: 'Intersex',
              },
            ],
          },
          {
            linkId: 'responsible-party-number',
            text: 'Phone (optional)',
            type: 'string',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Phone Number',
              },
            ],
          },
        ],
      },
      {
        linkId: 'id-page',
        text: 'Photo ID',
        type: 'group',
        item: [
          {
            linkId: 'id-page-caption',
            text: "Please upload a picture of a Photo ID, Drivers License or Passport of the patient's legal guardian (ie: Patient or Parent/Guardian)",
            type: 'display',
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/text-type',
                valueString: 'p',
              },
            ],
          },
          {
            linkId: 'id-front',
            text: 'Take a picture of the front side of your Photo ID (optional)',
            type: 'attachment',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
                valueString: 'Take a picture of the **front side** of your Photo ID',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
                valueString: '55188-7',
              },
            ],
          },
          {
            linkId: 'id-back',
            text: 'Take a picture of the back side of your Photo ID (optional)',
            type: 'attachment',
            required: false,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/attachment-text',
                valueString: 'Take a picture of the **back side** of your Photo ID',
              },
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/document-type',
                valueString: '55188-7',
              },
            ],
          },
        ],
      },
      {
        linkId: 'consent-forms-page',
        text: 'Complete consent forms',
        type: 'group',
        extension: [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/review-text',
            valueString: 'Consent forms',
          },
        ],
        item: [
          {
            linkId: 'hipaa-acknowledgement',
            text: 'I have reviewed and accept [HIPAA Acknowledgement](/HIPAA.Acknowledgement-S.pdf)',
            type: 'boolean',
            required: true,
          },
          {
            linkId: 'consent-to-treat',
            text: 'I have reviewed and accept [Consent to Treat and Guarantee of Payment](/CTT.and.Guarantee.of.Payment-S.pdf)',
            type: 'boolean',
            required: true,
          },
          {
            linkId: 'signature',
            text: 'Signature',
            type: 'string',
            required: true,
            extension: [
              {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/input-format',
                valueString: 'Signature',
              },
            ],
          },
          {
            linkId: 'full-name',
            text: 'Full name',
            type: 'string',
            required: true,
          },
          {
            linkId: 'consent-form-signer-relationship',
            text: 'Relationship to the patient',
            type: 'choice',
            required: true,
            answerOption: [
              {
                valueString: 'Parent',
              },
              {
                valueString: 'Self',
              },
              {
                valueString: 'Legal Guardian',
              },
              {
                valueString: 'Other',
              },
            ],
          },
        ],
      },
    ],
  };

  const prevQuestionnaire = await fhirClient.searchResources({
    resourceType: 'Questionnaire',
    searchParams: [
      {
        name: 'name',
        value: newQuestionnaire.name || 'paperwork',
      },
    ],
  });

  console.log('Received questionnaires from fhir.');

  if (!prevQuestionnaire.length) {
    return await fhirClient.createResource(newQuestionnaire);
  } else {
    console.log('Questionnaire already exists.');
    return null;
  }
};

const createLocation = async (fhirClient: FhirClient) => {
  const newLocation: Location = {
    resourceType: 'Location',
    status: 'active',
    name: 'Testing',
    description: 'Test description',
    identifier: [
      {
        system: 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
        value: 'testing',
      },
    ],
    address: {
      use: 'work',
      type: 'physical',
      line: ['12345 Test St'],
      city: 'Test City',
      state: 'Test State',
      postalCode: '12345',
    },
    telecom: [
      {
        system: 'phone',
        use: 'work',
        value: '1234567890',
      },
      {
        system: 'url',
        use: 'work',
        value: 'https://example.com',
      },
    ],
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
        valueString:
          '{"schedule":{"monday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":10},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"tuesday":{"open":8,"close":21,"openingBuffer":0,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":10},{"hour":9,"capacity":5},{"hour":10,"capacity":7},{"hour":11,"capacity":4},{"hour":12,"capacity":8},{"hour":13,"capacity":11},{"hour":14,"capacity":1},{"hour":15,"capacity":2},{"hour":16,"capacity":1},{"hour":17,"capacity":1},{"hour":18,"capacity":2},{"hour":19,"capacity":2},{"hour":20,"capacity":6}]},"wednesday":{"open":8,"close":0,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":20},{"hour":9,"capacity":20},{"hour":10,"capacity":20},{"hour":11,"capacity":20},{"hour":12,"capacity":20},{"hour":13,"capacity":20},{"hour":14,"capacity":20},{"hour":15,"capacity":20},{"hour":16,"capacity":20},{"hour":17,"capacity":20},{"hour":18,"capacity":20},{"hour":19,"capacity":20},{"hour":20,"capacity":20},{"hour":21,"capacity":20},{"hour":22,"capacity":20},{"hour":23,"capacity":20}]},"thursday":{"open":18,"close":24,"openingBuffer":30,"closingBuffer":0,"workingDay":true,"hours":[{"hour":0,"capacity":0},{"hour":1,"capacity":0},{"hour":2,"capacity":0},{"hour":3,"capacity":0},{"hour":4,"capacity":0},{"hour":5,"capacity":0},{"hour":6,"capacity":0},{"hour":7,"capacity":0},{"hour":8,"capacity":0},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":12},{"hour":18,"capacity":10},{"hour":19,"capacity":10},{"hour":20,"capacity":10},{"hour":21,"capacity":0},{"hour":22,"capacity":10},{"hour":23,"capacity":10}]},"friday":{"open":14,"close":21,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":14,"capacity":5},{"hour":15,"capacity":6},{"hour":16,"capacity":6},{"hour":17,"capacity":5},{"hour":18,"capacity":5},{"hour":19,"capacity":5},{"hour":20,"capacity":5}]},"saturday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"sunday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]}},"scheduleOverrides":{"12/21/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"12/9/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"05/01/2024":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"1/19/2024":{"open":7,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]}}}',
      },
      {
        url: 'http://hl7.org/fhir/StructureDefinition/timezone',
        valueString: 'America/New_York',
      },
    ],
    hoursOfOperation: [
      {
        openingTime: '04:00:00',
        closingTime: '20:00:00',
        daysOfWeek: ['mon'],
      },
      {
        openingTime: '08:00:00',
        closingTime: '21:00:00',
        daysOfWeek: ['tue'],
      },
      {
        openingTime: '08:00:00',
        closingTime: '00:00:00',
        daysOfWeek: ['wed'],
      },
      {
        openingTime: '18:00:00',
        daysOfWeek: ['thu'],
      },
      {
        openingTime: '14:00:00',
        closingTime: '21:00:00',
        daysOfWeek: ['fri'],
      },
      {
        openingTime: '04:00:00',
        closingTime: '20:00:00',
        daysOfWeek: ['sat'],
      },
      {
        openingTime: '04:00:00',
        closingTime: '20:00:00',
        daysOfWeek: ['sun'],
      },
    ],
  };

  const prevLocations = await fhirClient.searchResources({
    resourceType: 'Location',
    searchParams: [
      {
        name: 'name',
        value: newLocation.name || 'Testing',
      },
    ],
  });

  console.log('Received locations from fhir.');

  if (!prevLocations.length) {
    return await fhirClient.createResource(newLocation);
  } else {
    console.log('Location already exists.');
    return null;
  }
};

export async function setupIntake(
  projectApiUrl: string,
  accessToken: string,
  projectId: string,
  providerEmail: string,
  m2mDeviceId: string,
  m2mClientId: string,
  m2mSecret: string,
): Promise<void> {
  console.log('Starting setup of Ottehr Urgent Care Intake...');
  const slug = uuidv4().replace(/-/g, '');

  const fhirClient = new FhirClient({
    apiUrl: 'https://fhir-api.zapehr.com',
    projectId: projectId,
    accessToken: accessToken,
  });

  const applicationName = 'Ottehr Urgent Care Intake';
  const [applicationId, clientId] = await createApplication(projectApiUrl, applicationName, accessToken, projectId);
  console.log(`Created application "${applicationName}".`);
  console.log(applicationId, clientId);

  const organizationID = (await createOrganization(fhirClient)).id;
  if (!organizationID) {
    throw new Error('Organization ID is not defined');
  }
  await createQuestionnaire(fhirClient);
  await createLocation(fhirClient);

  const envPath1 = createZambdaLocalEnvFile(projectId, m2mDeviceId, m2mClientId, m2mSecret, organizationID);
  console.log('Created environment file:', envPath1);

  const envPath2 = createAppLocalEnvFile(clientId);
  console.log('Created environment file:', envPath2);
  console.log('Setup of urgent care testing');
}
