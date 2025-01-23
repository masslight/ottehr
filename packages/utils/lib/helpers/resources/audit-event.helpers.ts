import { AuditEvent, AuditEventEntity, Patient, Practitioner, Reference } from 'fhir/r4b';

/**
 * This creates entity that reflects previous and new state of resource
 * or just one state of it as log.
 * @param name custom name for current versioned log.
 * @param previousVersionId resource version id from meta before update.
 * @param newVersionId resource version id from meta after update.
 * */
export interface VersionEntity {
  resourceReference: Reference;
  name?: string;
  previousVersionId?: string;
  newVersionId?: string;
  requestJson?: string;
}

export const AUDIT_EVENT_ENTITY_PREVIOUS_VERSION_ID_TYPE = 'previousVersionId';
export const AUDIT_EVENT_ENTITY_VERSION_ID_TYPE = 'versionId';
export const AUDIT_EVENT_ENTITY_REQUEST_JSON_TYPE = 'requestJson';

export function createAuditEventEntity(input: VersionEntity): AuditEventEntity {
  const { resourceReference, name, previousVersionId, newVersionId, requestJson } = input;
  const entity: AuditEventEntity = {
    what: resourceReference,
    name,
  };
  if (previousVersionId) {
    if (!entity.detail?.length) entity.detail = [];
    entity.detail.push({
      type: AUDIT_EVENT_ENTITY_PREVIOUS_VERSION_ID_TYPE,
      valueString: previousVersionId,
    });
  }
  if (newVersionId) {
    if (!entity.detail?.length) entity.detail = [];
    entity.detail.push({
      type: AUDIT_EVENT_ENTITY_VERSION_ID_TYPE,
      valueString: newVersionId,
    });
  }
  if (requestJson) {
    if (!entity.detail?.length) entity.detail = [];
    entity.detail.push({
      type: AUDIT_EVENT_ENTITY_REQUEST_JSON_TYPE,
      valueString: requestJson,
    });
  }
  return entity;
}

export function parseAuditEventEntity(entity: AuditEventEntity): VersionEntity {
  const resourceReference = entity.what;
  if (!resourceReference) throw new Error('This AE entity does not contain resource reference in .what field');
  const previousVersionId = entity.detail?.find((detail) => detail.type === AUDIT_EVENT_ENTITY_PREVIOUS_VERSION_ID_TYPE)
    ?.valueString;
  const newVersionId = entity.detail?.find((detail) => detail.type === AUDIT_EVENT_ENTITY_VERSION_ID_TYPE)?.valueString;
  const requestJson = entity.detail?.find((detail) => detail.type === AUDIT_EVENT_ENTITY_REQUEST_JSON_TYPE)
    ?.valueString;
  return {
    resourceReference,
    name: entity.name,
    previousVersionId,
    newVersionId,
    requestJson,
  };
}

export function getPersonIdFromAuditEvent(
  auditEvent: AuditEvent,
  personType: Patient['resourceType'] | Practitioner['resourceType']
): string | undefined {
  return auditEvent.agent
    .find((agent) => agent.who?.reference?.includes(personType))
    ?.who?.reference?.replace(`${personType}/`, '');
}
