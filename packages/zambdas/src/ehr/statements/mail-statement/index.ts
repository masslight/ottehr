import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  generateStatement,
  getSecret,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getStatementDetails,
  getStatementTemplate,
  sendPostGridLetter,
  StatementType,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'mail-statement';

interface MailStatementInput {
  encounterId: string;
  statementType: StatementType;
  color: boolean;
  secrets: Secrets;
}

const validStatementTypes = new Set<StatementType>(['standard', 'past-due', 'final-notice']);
let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    const oystehr = await createOystehr(validatedInput.secrets);

    const templatePayload = getStatementTemplate('statement-template');
    const statementDetails = await getStatementDetails({
      encounterId: validatedInput.encounterId,
      statementType: validatedInput.statementType,
      secrets: validatedInput.secrets,
      oystehr,
    });
    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: validatedInput.encounterId,
    });

    const html = generateStatement(templatePayload.template, statementDetails);
    const patientId = encounter.subject?.reference?.split('/')[1];
    if (!patientId) {
      throw new Error(`Patient id not found in "Encounter/${validatedInput.encounterId}"`);
    }

    const projectId = getSecret(SecretsKeys.PROJECT_ID, validatedInput.secrets);

    console.log(
      `Preparing to mail statement ${JSON.stringify({
        encounterId: validatedInput.encounterId,
        patientId,
        projectId,
      })}`
    );

    const description = `${statementDetails.biller.name} - Statement - ${statementDetails.patient.firstName} ${statementDetails.patient.lastName} - Visit on ${statementDetails.visit.date}`;

    const postGridLetter = await sendPostGridLetter(
      {
        description,
        from: {
          companyName: statementDetails.biller.name,
          addressLine1: statementDetails.biller.addressLine1,
          addressLine2: statementDetails.biller.addressLine2,
          city: statementDetails.biller.city,
          provinceOrState: statementDetails.biller.provinceOrState,
          postalOrZip: statementDetails.biller.postalOrZip,
          countryCode: statementDetails.biller.countryCode,
        },
        to: {
          firstName: statementDetails.respParty.firstName,
          lastName: statementDetails.respParty.lastName,
          addressLine1: statementDetails.respParty.addressLine1,
          addressLine2: statementDetails.respParty.addressLine2,
          city: statementDetails.respParty.city,
          provinceOrState: statementDetails.respParty.provinceOrState,
          postalOrZip: statementDetails.respParty.postalOrZip,
          countryCode: statementDetails.respParty.countryCode,
        },
        html,
        addressPlacement: 'top_first_page',
        color: validatedInput.color,
        doubleSided: true,
        metadata: {
          oyster_patient_id: patientId,
          oystehr_encounter_id: validatedInput.encounterId,
          oystehr_project_id: projectId,
        },
      },
      validatedInput.secrets
    );

    console.log(
      `Mailed statement ${JSON.stringify({
        encounterId: validatedInput.encounterId,
        color: validatedInput.color,
        mailId: postGridLetter.id,
        mailStatus: postGridLetter.status,
      })}`
    );

    const billingOrganizationRef = getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, validatedInput.secrets);

    const communication = await oystehr.fhir.create<Communication>({
      resourceType: 'Communication',
      status: 'in-progress',
      medium: [
        {
          coding: [
            {
              system: 'https://terminology.hl7.org/6.0.2/ValueSet-v3-ParticipationMode.html',
              code: 'MAILWRIT',
              display: 'mail',
            },
          ],
          text: 'mail',
        },
      ],
      subject: {
        reference: `Patient/${patientId}`,
      },
      encounter: {
        reference: `Encounter/${validatedInput.encounterId}`,
      },
      sender: {
        reference: billingOrganizationRef,
      },
      recipient: [
        {
          display: `${statementDetails.respParty.firstName} ${statementDetails.respParty.lastName}`,
        },
      ],
      payload: [
        {
          contentString: description,
        },
      ],
      sent: DateTime.now().toUTC().toISO() ?? undefined,
      extension: [
        {
          url: 'https://extensions.fhir.ottehr.com/mail-vendor',
          extension: [
            {
              url: 'vendor',
              valueString: 'postgrid',
            },
            {
              url: 'vendor-letter-id',
              valueString: postGridLetter.id,
            },
            {
              url: 'vendor-letter-status',
              valueString: postGridLetter.status,
            },
            {
              url: 'vendor-letter-url',
              valueString: postGridLetter.url ?? '',
            },
            {
              url: 'vendor-send-date',
              valueString: postGridLetter.sendDate ?? '',
            },
          ],
        },
      ],
    });

    console.log(`Created Communication/${communication.id} for mail tracking`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        mailId: postGridLetter.id,
        mailStatus: postGridLetter.status,
      }),
    };
  } catch (error: unknown) {
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

function validateRequestParameters(input: ZambdaInput): MailStatementInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = JSON.parse(input.body) as Record<string, unknown>;

  const encounterId = body.encounterId;
  if (typeof encounterId !== 'string' || encounterId.trim().length === 0) {
    throw new Error('encounterId is required');
  }

  const statementType = body.statementType;
  const color = body.color;

  if (typeof color !== 'boolean') {
    throw new Error('color must be a boolean (true or false)');
  }

  if (statementType == null) {
    return {
      encounterId,
      statementType: 'standard',
      color,
      secrets: input.secrets,
    };
  }

  if (typeof statementType !== 'string' || !validStatementTypes.has(statementType as StatementType)) {
    throw new Error('statementType must be one of: standard, past-due, final-notice');
  }

  return {
    encounterId,
    statementType: statementType as StatementType,
    color,
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(oystehrToken, secrets);
}
