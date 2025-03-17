import { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, Communication, Group, Location, Practitioner } from 'fhir/r4b';
import { COMMUNICATION_ISSUE_REPORT_CODE, getFullestAvailableName } from 'utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { getAuth0Token } from '../shared';
import { sendgridEmail, sendSlackNotification, topLevelCatch } from '../shared/errors';
import { createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { bundleResourcesConfig, codingContainedInList, getEmailsFromGroup } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface CommunicationSubscriptionInput {
  communication: Communication;
  secrets: Secrets | null;
}

let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { communication, secrets } = validatedParameters;
    console.log('communication ID', communication.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (['not-done', 'completed'].includes(communication.status)) {
      console.log(`task is marked ${communication.status}`);
      return {
        statusCode: 200,
        body: `communication has already been marked ${communication.status}`,
      };
    }

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    const communicationCodes = communication.category;
    console.log('communicationCodes', JSON.stringify(communicationCodes));
    let communicationStatusToUpdate: string | undefined;

    if (codingContainedInList(COMMUNICATION_ISSUE_REPORT_CODE, communicationCodes)) {
      console.log('alerting for issue report');
      const groupID = getSecret(SecretsKeys.INTAKE_ISSUE_REPORT_EMAIL_GROUP_ID, secrets);
      const templateID = getSecret(SecretsKeys.IN_PERSON_SENDGRID_ISSUE_REPORT_EMAIL_TEMPLATE_ID, secrets);

      // Only alert where both variables exist and are non null value
      if (groupID && templateID) {
        const groupGetRequest: BatchInputGetRequest = {
          method: 'GET',
          url: `/Group?_id=${groupID}`,
        };
        const locationID = communication.about
          ?.find((ref) => ref.type === 'Location')
          ?.reference?.replace('Location/', '');
        const locationGetRequest: BatchInputGetRequest = {
          method: 'GET',
          url: `/Location?_id=${locationID}`,
        };
        const practitionerID = communication.sender?.reference?.replace('Practitioner/', '');
        const practitionerGetRequest: BatchInputGetRequest = {
          method: 'GET',
          url: `/Practitioner?_id=${practitionerID}`,
        };
        const appointmentID = communication.about
          ?.find((ref) => ref.type === 'Appointment')
          ?.reference?.replace('Appointment/', '');

        console.log('getting fhir resources for issue report alerting');
        console.log('groupID, locationID, practitionerID', groupID, locationID, practitionerID);
        const bundle = await oystehr.fhir.batch({
          requests: [groupGetRequest, locationGetRequest, practitionerGetRequest],
        });

        const bundleResources: bundleResourcesConfig = {};
        if (bundle.entry) {
          for (const entry of bundle.entry) {
            if (
              entry.response?.outcome?.id === 'ok' &&
              entry.resource &&
              entry.resource.resourceType === 'Bundle' &&
              entry.resource.type === 'searchset'
            ) {
              const innerBundle = entry.resource as Bundle;
              const innerEntries = innerBundle.entry;
              if (innerEntries) {
                for (const item of innerEntries) {
                  const resource = item.resource;
                  if (resource) {
                    if (resource?.resourceType === 'Group') {
                      bundleResources.group = resource as Group;
                    }
                    if (resource?.resourceType === 'Location') {
                      bundleResources.location = resource as Location;
                    }
                    if (resource?.resourceType === 'Practitioner') {
                      bundleResources.practitioner = resource as Practitioner;
                    }
                  }
                }
              }
            }
          }
        }
        const submitter = bundleResources.practitioner;
        const fhirLocation = bundleResources.location;
        const fhirGroup = bundleResources.group;

        let submitterName = submitter && getFullestAvailableName(submitter);
        let submitterEmail = '';
        try {
          const PROJECT_API = getSecret('PROJECT_API', secrets);
          const headers = {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${zapehrToken}`,
          };
          const getUserByProfileResponse = await fetch(
            `${PROJECT_API}/user/v2/list?profile=Practitioner/${practitionerID}`,
            {
              method: 'GET',
              headers: headers,
            }
          );
          if (!getUserByProfileResponse.ok) {
            console.error('Failed to get user from a given Practitioner ID profile');
          }
          const retrievedUser = await getUserByProfileResponse.json();
          if (submitterName == undefined) {
            submitterName = `${retrievedUser?.data?.[0]?.name}`;
          }
          submitterEmail = `${retrievedUser?.data?.[0]?.email}`;
        } catch (error) {
          console.error('Fetch call failed with error: ', error);
        }
        const submitterDetails = `Submitter name: ${submitterName}, Submitter email: ${submitterEmail}, Submitter id: ${submitter?.id}`;

        console.log('sending slack message');
        const slackMessage = `An issue report has been submitted from ${fhirLocation?.name}. Check payload in communication resource ${communication.id} for more information`;
        try {
          await sendSlackNotification(slackMessage, ENVIRONMENT);
          communicationStatusToUpdate = 'completed';
        } catch (e) {
          console.log('could not send slack notification');
        }

        console.log('getting emails');
        const pracitionersEmails = await getEmailsFromGroup(fhirGroup, oystehr);
        console.log('pracitionersEmails', pracitionersEmails);

        const fromEmail = 'support@ottehr.com';
        const toEmail = pracitionersEmails || [fromEmail];
        const errorMessage = `Details: ${communication.payload?.[0].contentString} <br> Submitted By: ${submitterDetails} <br> Location: ${fhirLocation?.name} - ${fhirLocation?.address?.city}, ${fhirLocation?.address?.state} <br> Appointment Id: ${appointmentID} <br> Communication Fhir Resource: ${communication.id}`;

        console.log(`Sending issue report email to ${toEmail} with template id ${templateID}`);
        try {
          const sendResult = await sendgridEmail(secrets, templateID, toEmail, fromEmail, ENVIRONMENT, errorMessage);
          if (sendResult)
            console.log(
              `Details of successful sendgrid send: statusCode, ${sendResult[0].statusCode}. body, ${JSON.stringify(
                sendResult[0].body
              )}`
            );
          communicationStatusToUpdate = 'completed';
        } catch (error) {
          console.error(`Error sending email to ${toEmail}: ${JSON.stringify(error)}`);
        }
      }
    }

    if (!communicationStatusToUpdate) {
      console.log('no communication was attempted');
      communicationStatusToUpdate = 'not-done';
    }

    console.log('making patch request to update communication status');
    await oystehr.fhir.patch({
      resourceType: 'Communication',
      id: communication.id || '',
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: communicationStatusToUpdate,
        },
      ],
    });

    const response = {
      communicationStatus: communicationStatusToUpdate,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('admin-communication-subscription', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
