import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter } from 'fhir/r4b';
import {
  TEAM_CHAT_ENCOUNTER_IDENTIFIER_SYSTEM,
  TEAM_CHAT_ENCOUNTER_IDENTIFIER_VALUE,
  TeamChatAccessResponse,
} from 'utils/lib/types/api/team-chat.types';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'team-chat-access';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateRequestParameters(input);
  const userToken = getUserToken(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const user = await getUser(userToken, secrets);
  const practitionerReference = user.profile;
  if (!practitionerReference?.startsWith('Practitioner/')) {
    throw new Error(`Team chat is only available to users with a Practitioner profile; got "${practitionerReference}"`);
  }

  const encounter = (await findTeamChatEncounter(oystehr)) ?? (await createTeamChatConversation(oystehr));
  console.log(`Team chat encounter: ${encounter.id}`);

  const conversationId = oystehr.conversation.getConversationIdFromEncounter(encounter);
  if (!conversationId) {
    throw new Error(`Team chat Encounter/${encounter.id} is missing its conversation id extension`);
  }

  await ensureChatParticipant(oystehr, encounter, conversationId, practitionerReference);

  // The Get Token endpoint mints a Twilio token scoped to the identity of the caller,
  // so it must be invoked with the user's own bearer token, not the M2M token.
  const oystehrAsUser = createClinicalOystehrClient(userToken, secrets);
  const { token } = await oystehrAsUser.conversation.getToken();

  const response: TeamChatAccessResponse = { conversationId, token };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function findTeamChatEncounter(oystehr: Oystehr): Promise<Encounter | undefined> {
  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: 'identifier',
          value: `${TEAM_CHAT_ENCOUNTER_IDENTIFIER_SYSTEM}|${TEAM_CHAT_ENCOUNTER_IDENTIFIER_VALUE}`,
        },
        {
          name: 'status',
          value: 'in-progress',
        },
      ],
    })
  ).unbundle();
  return encounters[0];
}

// Two users hitting this concurrently on a fresh project can each create a
// conversation; whichever Encounter the search returns first wins afterward,
// and the orphan holds no messages. Acceptable while this feature is a spike.
async function createTeamChatConversation(oystehr: Oystehr): Promise<Encounter> {
  console.log('No team chat encounter found, creating the conversation');
  const { encounter } = await oystehr.conversation.create({
    encounter: {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual',
      },
      identifier: [
        {
          system: TEAM_CHAT_ENCOUNTER_IDENTIFIER_SYSTEM,
          value: TEAM_CHAT_ENCOUNTER_IDENTIFIER_VALUE,
        },
      ],
    },
  });
  return encounter;
}

async function ensureChatParticipant(
  oystehr: Oystehr,
  encounter: Encounter,
  conversationId: string,
  practitionerReference: string
): Promise<void> {
  const alreadyOnEncounter =
    encounter.participant?.some((participant) => participant.individual?.reference === practitionerReference) ?? false;

  if (!alreadyOnEncounter) {
    // The add-participant endpoint requires the reference to be present in
    // Encounter.participant before it is called.
    await oystehr.fhir.update<Encounter>({
      ...encounter,
      participant: [...(encounter.participant ?? []), { individual: { reference: practitionerReference } }],
    });
  }

  try {
    await oystehr.conversation.addParticipant({
      encounterReference: `Encounter/${encounter.id}`,
      conversationId,
      participants: [
        {
          participantReference: practitionerReference,
          channel: 'chat',
        },
      ],
    });
    console.log(`Added ${practitionerReference} to conversation ${conversationId}`);
  } catch (error) {
    // A user already on the Encounter has usually already been added to the
    // conversation on a previous call; a duplicate add then fails here.
    if (!alreadyOnEncounter) {
      throw error;
    }
    console.log(`addParticipant failed for existing encounter participant ${practitionerReference}, continuing`, error);
  }
}
