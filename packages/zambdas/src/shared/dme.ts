import {
  ActivityDefinition,
  ContactPoint,
  DeviceRequest,
  DeviceRequestParameter,
  Extension,
  Organization,
  Procedure,
  Provenance,
} from 'fhir/r4b';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_ICD_10 } from 'utils/lib/helpers/rcm/constants';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  DME_BILLING_CODE_EXTENSION_URL,
  DME_DISPENSED_EXTENSION_URL,
  DME_DURATION_UNITS,
  DME_FULFILLMENT_EXTENSION_URL,
  DME_ITEM_CODE_SYSTEM,
  DME_LATERALITY_OPTIONS,
  DME_MENU_ITEM_TAG_CODE,
  DME_MENU_ITEM_TAG_SYSTEM,
  DME_MODIFIER_LABELS,
  DME_MODIFIER_OPTIONS,
  DME_ORDER_PARAMETER_SYSTEM,
  DME_ORDER_TAG_CODE,
  DME_ORDER_TAG_SYSTEM,
  DME_THIRD_PARTY_CONTAINED_ID,
  DME_THIRD_PARTY_IDENTIFIER_SYSTEM,
  DmeDurationUnit,
  DmeLaterality,
  DmeMenuItem,
  DmeModifier,
  DmeOrderDTO,
  DmeOrderStatus,
  DmeThirdParty,
  ParsedDmeOrderFields,
} from 'utils/lib/types/api/dme.types';
import { makeProcedureResource } from './chart-data';

export const DME_MENU_ITEM_SEARCH_TAG = `${DME_MENU_ITEM_TAG_SYSTEM}|${DME_MENU_ITEM_TAG_CODE}`;
export const DME_ORDER_SEARCH_TAG = `${DME_ORDER_TAG_SYSTEM}|${DME_ORDER_TAG_CODE}`;

const PARAM = {
  quantity: 'quantity',
  laterality: 'laterality',
  modifier: 'modifier',
  duration: 'duration',
} as const;

const DISPENSED_BY = 'by';
const DISPENSED_AT = 'at';

// ---- DME menu ----

export const makeDmeMenuItemActivityDefinition = (
  input: { name: string; hcpcsCodes: { code: string; display: string }[] },
  id?: string
): ActivityDefinition => ({
  resourceType: 'ActivityDefinition',
  ...(id ? { id } : {}),
  meta: { tag: [{ system: DME_MENU_ITEM_TAG_SYSTEM, code: DME_MENU_ITEM_TAG_CODE }] },
  status: 'active',
  kind: 'DeviceRequest',
  title: input.name.trim(),
  code: input.hcpcsCodes.length
    ? { coding: input.hcpcsCodes.map((c) => ({ system: CODE_SYSTEM_CPT, code: c.code, display: c.display })) }
    : undefined,
});

export const parseDmeMenuItem = (resource: ActivityDefinition): DmeMenuItem | undefined => {
  if (!resource.id || !resource.title) return undefined;
  return {
    id: resource.id,
    name: resource.title,
    hcpcsCodes: (resource.code?.coding ?? [])
      .filter((c) => c.code)
      .map((c) => ({ code: c.code!, display: c.display ?? '' })),
  };
};

export const isDmeMenuItem = (resource: ActivityDefinition): boolean =>
  !!resource.meta?.tag?.some((t) => t.system === DME_MENU_ITEM_TAG_SYSTEM && t.code === DME_MENU_ITEM_TAG_CODE);

// ---- DME orders ----

const makeThirdPartyOrganization = (thirdParty: DmeThirdParty): Organization => {
  const telecom: ContactPoint[] = [
    ...(thirdParty.phone ? [{ system: 'phone' as const, value: thirdParty.phone }] : []),
    ...(thirdParty.fax ? [{ system: 'fax' as const, value: thirdParty.fax }] : []),
  ];
  return {
    resourceType: 'Organization',
    id: DME_THIRD_PARTY_CONTAINED_ID,
    // satisfies org-1 (name or identifier) when only an address, phone or fax is entered
    identifier: [{ system: DME_THIRD_PARTY_IDENTIFIER_SYSTEM, value: 'external' }],
    name: thirdParty.name || undefined,
    address: thirdParty.address ? [{ text: thirdParty.address }] : undefined,
    telecom: telecom.length ? telecom : undefined,
  };
};

const hasThirdPartyDetails = (thirdParty: DmeThirdParty | undefined): thirdParty is DmeThirdParty =>
  !!thirdParty && Object.values(thirdParty).some((v) => !!v?.trim());

const makeParameters = (fields: ParsedDmeOrderFields): DeviceRequestParameter[] => {
  const code = (c: string): DeviceRequestParameter['code'] => ({
    coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: c }],
  });
  const params: DeviceRequestParameter[] = [{ code: code(PARAM.quantity), valueQuantity: { value: fields.quantity } }];
  if (fields.laterality) {
    params.push({
      code: code(PARAM.laterality),
      valueCodeableConcept: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: fields.laterality }] },
    });
  }
  if (fields.modifier) {
    params.push({
      code: code(PARAM.modifier),
      valueCodeableConcept: { coding: [{ system: DME_ORDER_PARAMETER_SYSTEM, code: fields.modifier }] },
    });
  }
  if (fields.duration) {
    params.push({
      code: code(PARAM.duration),
      valueQuantity: { value: fields.duration.value, unit: fields.duration.unit },
    });
  }
  return params;
};

/** Builds the order content; status, dispensed info and identity are carried over from `existing` on edit. */
export const makeDmeDeviceRequest = (input: {
  fields: ParsedDmeOrderFields;
  encounterId: string;
  patientId: string;
  existing?: DeviceRequest;
}): DeviceRequest => {
  const { fields, encounterId, patientId, existing } = input;
  const external = fields.external;
  const thirdParty = external && hasThirdPartyDetails(fields.thirdParty) ? fields.thirdParty : undefined;

  const extension: Extension[] = [
    { url: DME_FULFILLMENT_EXTENSION_URL, valueCode: external ? 'external' : 'in-house' },
    ...fields.billingCodes.map((c) => ({
      url: DME_BILLING_CODE_EXTENSION_URL,
      valueCoding: { system: CODE_SYSTEM_CPT, code: c.code, display: c.display },
    })),
    ...(existing?.extension?.filter((e) => e.url === DME_DISPENSED_EXTENSION_URL) ?? []),
  ];

  return {
    resourceType: 'DeviceRequest',
    ...(existing?.id ? { id: existing.id } : {}),
    meta: { tag: [{ system: DME_ORDER_TAG_SYSTEM, code: DME_ORDER_TAG_CODE }] },
    status: existing?.status ?? 'active',
    intent: 'order',
    contained: thirdParty ? [makeThirdPartyOrganization(thirdParty)] : undefined,
    extension,
    codeCodeableConcept: {
      coding: fields.menuItemId
        ? [{ system: DME_ITEM_CODE_SYSTEM, code: fields.menuItemId, display: fields.itemName }]
        : undefined,
      text: fields.itemName,
    },
    parameter: makeParameters(fields),
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    authoredOn: existing?.authoredOn ?? new Date().toISOString(),
    requester: { reference: `Practitioner/${fields.orderedByPractitionerId}` },
    performer: thirdParty ? { reference: `#${DME_THIRD_PARTY_CONTAINED_ID}` } : undefined,
    reasonCode: fields.diagnoses.length
      ? fields.diagnoses.map((dx) => ({ coding: [{ system: CODE_SYSTEM_ICD_10, code: dx.code, display: dx.display }] }))
      : undefined,
    note: fields.instructions?.trim() ? [{ text: fields.instructions.trim() }] : undefined,
  };
};

export const makeDmeDispensedExtension = (practitionerId: string | undefined, at: string): Extension => ({
  url: DME_DISPENSED_EXTENSION_URL,
  extension: [
    ...(practitionerId ? [{ url: DISPENSED_BY, valueReference: { reference: `Practitioner/${practitionerId}` } }] : []),
    { url: DISPENSED_AT, valueDateTime: at },
  ],
});

const billingModifiers = (fields: ParsedDmeOrderFields): { code: string; display: string }[] => {
  const modifiers: { code: string; display: string }[] = [];
  if (fields.laterality === 'LT' || fields.laterality === 'BI') modifiers.push({ code: 'LT', display: 'Left side' });
  if (fields.laterality === 'RT' || fields.laterality === 'BI') modifiers.push({ code: 'RT', display: 'Right side' });
  if (fields.modifier) modifiers.push({ code: fields.modifier, display: DME_MODIFIER_LABELS[fields.modifier] });
  return modifiers;
};

/**
 * One billing Procedure per HCPCS code for in-house orders; third-party fulfillment is billed by the vendor.
 * Procedure.basedOn can't target a DeviceRequest, so the order links them through DeviceRequest.supportingInfo.
 */
export const makeDmeBillingProcedures = (input: {
  fields: ParsedDmeOrderFields;
  encounterId: string;
  patientId: string;
}): Procedure[] => {
  const { fields, encounterId, patientId } = input;
  if (fields.external) return [];
  const modifier = billingModifiers(fields);
  return fields.billingCodes.map((c) =>
    makeProcedureResource(
      encounterId,
      patientId,
      { code: c.code, display: c.display, modifier, billableUnits: fields.quantity },
      'cpt-code'
    )
  );
};

const PROVENANCE_ACTIVITY_SYSTEM = 'https://identifiers.fhir.oystehr.com/provenance-activity-type';
const DME_PROVENANCE_ACTIVITY = {
  create: 'CREATE ORDER',
  update: 'UPDATE ORDER',
  dispense: 'COMPLETE ORDER',
  delete: 'CANCEL ORDER',
} as const;

/** Records who actually entered a change; the requester may be a different provider the order was placed for. */
export const makeDmeProvenance = (input: {
  target: string;
  activity: keyof typeof DME_PROVENANCE_ACTIVITY;
  callerPractitionerId: string | undefined;
  requesterReference: string | undefined;
}): Provenance | undefined => {
  const { target, activity, callerPractitionerId, requesterReference } = input;
  if (!callerPractitionerId) return undefined;
  const code = DME_PROVENANCE_ACTIVITY[activity];
  return {
    resourceType: 'Provenance',
    activity: { coding: [{ system: PROVENANCE_ACTIVITY_SYSTEM, code, display: code.toLowerCase() }] },
    target: [{ reference: target }],
    recorded: new Date().toISOString(),
    agent: [
      {
        who: { reference: `Practitioner/${callerPractitionerId}` },
        ...(requesterReference ? { onBehalfOf: { reference: requesterReference } } : {}),
      },
    ],
  };
};

const getParam = (dr: DeviceRequest, code: string): DeviceRequestParameter | undefined =>
  dr.parameter?.find((p) => p.code?.coding?.some((c) => c.system === DME_ORDER_PARAMETER_SYSTEM && c.code === code));

const getParamCode = (dr: DeviceRequest, code: string): string | undefined =>
  getParam(dr, code)?.valueCodeableConcept?.coding?.find((c) => c.system === DME_ORDER_PARAMETER_SYSTEM)?.code;

export const isDmeOrderExternal = (dr: DeviceRequest): boolean =>
  dr.extension?.find((e) => e.url === DME_FULFILLMENT_EXTENSION_URL)?.valueCode === 'external';

export const getDmeOrderStatus = (dr: DeviceRequest): DmeOrderStatus => {
  if (dr.status === 'completed') return DmeOrderStatus.dispensed;
  return isDmeOrderExternal(dr) ? DmeOrderStatus.ordered : DmeOrderStatus.pending;
};

export const isDmeOrderDeleted = (dr: DeviceRequest): boolean =>
  dr.status === 'revoked' || dr.status === 'entered-in-error';

export const getDmeDispensed = (dr: DeviceRequest): { practitionerId?: string; at: string } | undefined => {
  const ext = dr.extension?.find((e) => e.url === DME_DISPENSED_EXTENSION_URL);
  const at = ext?.extension?.find((e) => e.url === DISPENSED_AT)?.valueDateTime;
  if (!at) return undefined;
  const ref = ext?.extension?.find((e) => e.url === DISPENSED_BY)?.valueReference?.reference;
  return { practitionerId: ref?.replace('Practitioner/', ''), at };
};

const oneOf = <T extends string>(options: readonly T[], value: string | undefined): T | undefined =>
  options.includes(value as T) ? (value as T) : undefined;

/** `practitionerNames` maps Practitioner id → display name for the requester and dispenser. */
export const parseDmeOrder = (dr: DeviceRequest, practitionerNames: Record<string, string>): DmeOrderDTO => {
  const orderedById = dr.requester?.reference?.replace('Practitioner/', '') ?? '';
  const thirdPartyOrg = dr.contained?.find(
    (r): r is Organization => r.resourceType === 'Organization' && r.id === DME_THIRD_PARTY_CONTAINED_ID
  );
  const durationParam = getParam(dr, PARAM.duration)?.valueQuantity;
  const durationUnit = oneOf<DmeDurationUnit>(DME_DURATION_UNITS, durationParam?.unit);
  const dispensed = getDmeDispensed(dr);
  const billingCodes: CPTCodeDTO[] = (dr.extension ?? [])
    .filter((e) => e.url === DME_BILLING_CODE_EXTENSION_URL && e.valueCoding?.code)
    .map((e) => ({ code: e.valueCoding!.code!, display: e.valueCoding!.display ?? '' }));

  return {
    id: dr.id ?? '',
    encounterId: dr.encounter?.reference?.replace('Encounter/', '') ?? '',
    menuItemId: dr.codeCodeableConcept?.coding?.find((c) => c.system === DME_ITEM_CODE_SYSTEM)?.code,
    itemName: dr.codeCodeableConcept?.text ?? dr.codeCodeableConcept?.coding?.[0]?.display ?? '',
    diagnoses: (dr.reasonCode ?? [])
      .map((rc) => rc.coding?.[0])
      .filter((c) => c?.code)
      .map((c) => ({ code: c!.code!, display: c!.display ?? '' })),
    quantity: getParam(dr, PARAM.quantity)?.valueQuantity?.value ?? 1,
    billingCodes,
    laterality: oneOf<DmeLaterality>(DME_LATERALITY_OPTIONS, getParamCode(dr, PARAM.laterality)),
    modifier: oneOf<DmeModifier>(DME_MODIFIER_OPTIONS, getParamCode(dr, PARAM.modifier)),
    duration: durationParam?.value && durationUnit ? { value: durationParam.value, unit: durationUnit } : undefined,
    instructions: dr.note?.[0]?.text,
    external: isDmeOrderExternal(dr),
    thirdParty: thirdPartyOrg
      ? {
          name: thirdPartyOrg.name,
          address: thirdPartyOrg.address?.[0]?.text,
          phone: thirdPartyOrg.telecom?.find((t) => t.system === 'phone')?.value,
          fax: thirdPartyOrg.telecom?.find((t) => t.system === 'fax')?.value,
        }
      : undefined,
    status: getDmeOrderStatus(dr),
    orderedBy: { practitionerId: orderedById, name: practitionerNames[orderedById] ?? '' },
    orderedAt: dr.authoredOn ?? '',
    dispensed: dispensed
      ? {
          ...dispensed,
          name: dispensed.practitionerId ? practitionerNames[dispensed.practitionerId] : undefined,
        }
      : undefined,
  };
};

export const getDmePractitionerIds = (dr: DeviceRequest): string[] =>
  [
    dr.requester?.reference,
    getDmeDispensed(dr)?.practitionerId && `Practitioner/${getDmeDispensed(dr)?.practitionerId}`,
  ]
    .filter((ref): ref is string => !!ref && ref.startsWith('Practitioner/'))
    .map((ref) => ref.replace('Practitioner/', ''));
