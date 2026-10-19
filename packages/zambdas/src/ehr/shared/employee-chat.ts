import { Extension, Group, Practitioner } from 'fhir/r4b';
import { getFirstName, getFullestAvailableName, getLastName } from 'utils/lib/fhir/patient';
import { Secrets } from 'utils/lib/secrets';
import {
  EMPLOYEE_CHAT_CODE,
  EMPLOYEE_CHAT_CODE_SYSTEM,
  EMPLOYEE_CHAT_CONVERSATION_ENCOUNTER_EXTENSION_URL,
  EMPLOYEE_CHAT_CONVERSATION_SID_EXTENSION_URL,
  EMPLOYEE_CHAT_PAIR_SYSTEM,
  EMPLOYEE_CHAT_PREVIOUS_CONVERSATION_EXTENSION_URL,
  EmployeeChatSummary,
} from 'utils/lib/types/api/employee-chat.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { getUser } from '../../shared/auth';

const PRACTITIONER_PREFIX = 'Practitioner/';

export function practitionerIdFromProfile(profile: string): string {
  if (!profile.startsWith(PRACTITIONER_PREFIX)) {
    throw new Error(`Expected a Practitioner reference, got "${profile}"`);
  }
  return profile.slice(PRACTITIONER_PREFIX.length);
}

export function pairKey(profileA: string, profileB: string): string {
  const [low, high] = [practitionerIdFromProfile(profileA), practitionerIdFromProfile(profileB)].sort();
  return `${low}_${high}`;
}

export function pairIdentifierQuery(profileA: string, profileB: string): string {
  return `${EMPLOYEE_CHAT_PAIR_SYSTEM}|${pairKey(profileA, profileB)}`;
}

export const EMPLOYEE_CHAT_CODE_QUERY = `${EMPLOYEE_CHAT_CODE_SYSTEM}|${EMPLOYEE_CHAT_CODE}`;

export function buildPairGroup(profileA: string, profileB: string): Group {
  const [low, high] = [profileA, profileB].sort();
  return {
    resourceType: 'Group',
    type: 'practitioner',
    actual: true,
    quantity: 2,
    identifier: [{ system: EMPLOYEE_CHAT_PAIR_SYSTEM, value: pairKey(profileA, profileB) }],
    code: { coding: [{ system: EMPLOYEE_CHAT_CODE_SYSTEM, code: EMPLOYEE_CHAT_CODE }] },
    member: [{ entity: { reference: low } }, { entity: { reference: high } }],
  };
}

export interface RetiredConversation {
  sid: string;
  encounter: string;
  retiredAt: string;
}

export function readConversationSid(group: Group): string | undefined {
  return group.extension?.find((extension) => extension.url === EMPLOYEE_CHAT_CONVERSATION_SID_EXTENSION_URL)
    ?.valueString;
}

export function readConversationEncounter(group: Group): string | undefined {
  return group.extension?.find((extension) => extension.url === EMPLOYEE_CHAT_CONVERSATION_ENCOUNTER_EXTENSION_URL)
    ?.valueReference?.reference;
}

export function readPreviousConversations(group: Group): RetiredConversation[] {
  return (group.extension ?? [])
    .filter((extension) => extension.url === EMPLOYEE_CHAT_PREVIOUS_CONVERSATION_EXTENSION_URL)
    .map((extension) => {
      const part = (url: string): Extension | undefined => extension.extension?.find((inner) => inner.url === url);
      return {
        sid: part('sid')?.valueString ?? '',
        encounter: part('encounter')?.valueReference?.reference ?? '',
        retiredAt: part('retiredAt')?.valueDateTime ?? '',
      };
    })
    .filter((retired) => retired.sid !== '');
}

function withCurrentConversation(group: Group, conversationSid: string, encounterReference: string | undefined): Group {
  const otherExtensions = (group.extension ?? []).filter(
    (extension) =>
      extension.url !== EMPLOYEE_CHAT_CONVERSATION_SID_EXTENSION_URL &&
      extension.url !== EMPLOYEE_CHAT_CONVERSATION_ENCOUNTER_EXTENSION_URL
  );
  return {
    ...group,
    extension: [
      ...otherExtensions,
      { url: EMPLOYEE_CHAT_CONVERSATION_SID_EXTENSION_URL, valueString: conversationSid },
      ...(encounterReference
        ? [
            {
              url: EMPLOYEE_CHAT_CONVERSATION_ENCOUNTER_EXTENSION_URL,
              valueReference: { reference: encounterReference },
            },
          ]
        : []),
    ],
  };
}

function retiredConversationExtension({ sid, encounter, retiredAt }: RetiredConversation): Extension {
  return {
    url: EMPLOYEE_CHAT_PREVIOUS_CONVERSATION_EXTENSION_URL,
    extension: [
      { url: 'sid', valueString: sid },
      ...(encounter ? [{ url: 'encounter', valueReference: { reference: encounter } }] : []),
      ...(retiredAt ? [{ url: 'retiredAt', valueDateTime: retiredAt }] : []),
    ],
  };
}

export function withConversation(group: Group, conversationSid: string, encounterId: string): Group {
  return withCurrentConversation(group, conversationSid, `Encounter/${encounterId}`);
}

export function withReplacement(group: Group, conversationSid: string, encounterId: string, retiredAt: string): Group {
  const retiredSid = readConversationSid(group);
  if (!retiredSid) {
    throw new Error(`Employee chat Group/${group.id} has no current conversation to replace`);
  }
  const retired = retiredConversationExtension({
    sid: retiredSid,
    encounter: readConversationEncounter(group) ?? '',
    retiredAt,
  });
  return withConversation({ ...group, extension: [...(group.extension ?? []), retired] }, conversationSid, encounterId);
}

export function conversationSidsOf(group: Group): string[] {
  const current = readConversationSid(group);
  return [...readPreviousConversations(group).map((retired) => retired.sid), ...(current ? [current] : [])];
}

export function selectCanonicalGroup(groups: Group[]): { canonical: Group; duplicates: Group[] } {
  const [canonical, ...duplicates] = [...groups].sort((a, b) => {
    const [left, right] = [a.id ?? '', b.id ?? ''];
    return left < right ? -1 : left > right ? 1 : 0;
  });
  if (!canonical) {
    throw new Error('Cannot select a canonical employee chat Group from an empty list');
  }
  return { canonical, duplicates };
}

export interface ReconciledPairGroups {
  canonical: Group;
  reconciled: Group;
  retired: RetiredConversation[];
  changed: boolean;
}

export function reconcilePairGroups(groups: Group[], retiredAt: string): ReconciledPairGroups {
  const { canonical, duplicates } = selectCanonicalGroup(groups);
  const known = new Set(conversationSidsOf(canonical));
  const history: RetiredConversation[] = [];
  const retired: RetiredConversation[] = [];
  let reconciled = canonical;
  let adopted = false;

  for (const duplicate of duplicates) {
    for (const previous of readPreviousConversations(duplicate)) {
      if (known.has(previous.sid)) continue;
      known.add(previous.sid);
      history.push(previous);
    }
    const sid = readConversationSid(duplicate);
    if (!sid || known.has(sid)) continue;
    known.add(sid);
    const encounter = readConversationEncounter(duplicate);
    if (!readConversationSid(reconciled)) {
      reconciled = withCurrentConversation(reconciled, sid, encounter);
      adopted = true;
    } else {
      const moved = { sid, encounter: encounter ?? '', retiredAt };
      history.push(moved);
      retired.push(moved);
    }
  }

  if (history.length > 0) {
    reconciled = {
      ...reconciled,
      extension: [...(reconciled.extension ?? []), ...history.map(retiredConversationExtension)],
    };
  }
  return { canonical, reconciled, retired, changed: adopted || history.length > 0 };
}

export function otherMemberProfile(group: Group, myProfile: string): string | undefined {
  const references = (group.member ?? [])
    .map((member) => member.entity.reference)
    .filter((reference): reference is string => !!reference);
  if (references.length !== 2 || !references.includes(myProfile)) return undefined;
  return references.find((reference) => reference !== myProfile);
}

export function buildSummary(
  conversationSid: string,
  otherProfile: string,
  practitioner: Practitioner | undefined,
  previousConversationSids: string[] = []
): EmployeeChatSummary {
  const firstName = (practitioner && getFirstName(practitioner)) ?? '';
  const lastName = (practitioner && getLastName(practitioner)) ?? '';
  const name = (practitioner && getFullestAvailableName(practitioner)) || `${firstName} ${lastName}`.trim();
  return {
    conversationSid,
    previousConversationSids,
    otherEmployee: { profile: otherProfile, firstName, lastName, name: name || 'Unknown employee' },
  };
}

export function toSummary(
  group: Group,
  practitionersByProfile: Map<string, Practitioner>,
  myProfile: string
): EmployeeChatSummary | undefined {
  const conversationSid = readConversationSid(group);
  const otherProfile = otherMemberProfile(group, myProfile);
  if (!conversationSid || !otherProfile) return undefined;
  return buildSummary(
    conversationSid,
    otherProfile,
    practitionersByProfile.get(otherProfile),
    readPreviousConversations(group).map((retired) => retired.sid)
  );
}

export async function requireCallerPractitioner(userToken: string, secrets: Secrets | null): Promise<string> {
  const user = await getUser(userToken, secrets);
  if (!user.profile?.startsWith(PRACTITIONER_PREFIX)) {
    throw NOT_AUTHORIZED;
  }
  return user.profile;
}
