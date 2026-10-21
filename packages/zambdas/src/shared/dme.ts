import {
  ActivityDefinition,
  Coding,
  ContactPoint,
  DeviceRequest,
  DeviceRequestParameter,
  Extension,
  Organization,
  Procedure,
  Provenance,
  Timing,
} from 'fhir/r4b';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_CPT_MODIFIER, CODE_SYSTEM_ICD_10 } from 'utils/lib/helpers/rcm/constants';
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
import { PROVENANCE_ACTIVITY_TYPE_SYSTEM, SNOMED_CODE_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { makeProcedureResource } from './chart-data';

export const DME_MENU_ITEM_SEARCH_TAG = `${DME_MENU_ITEM_TAG_SYSTEM}|${DME_MENU_ITEM_TAG_CODE}`;
export const DME_ORDER_SEARCH_TAG = `${DME_ORDER_TAG_SYSTEM}|${DME_ORDER_TAG_CODE}`;
/** On a billing Procedure: the DeviceRequest it bills for (Procedure.basedOn can't target a DeviceRequest). */
export const DME_BILLED_ORDER_EXTENSION_URL = ottehrExtensionUrl('dme-order');
/** On the DeviceRequest, one per billing Procedure: the authoritative link, as a chart edit can drop the Procedure's own. */
export const DME_BILLING_PROCEDURE_EXTENSION_URL = ottehrExtensionUrl('dme-billing-procedure');

const QUANTITY_PARAMETER: Coding = { system: DME_ORDER_PARAMETER_SYSTEM, code: 'quantity' };
const MODIFIER_PARAMETER: Coding = { system: DME_ORDER_PARAMETER_SYSTEM, code: 'modifier' };
const LATERALITY_PARAMETER: Coding = { system: SNOMED_CODE_SYSTEM, code: '272741003', display: 'Laterality' };
const NULL_FLAVOR_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor';
const LATERALITY_CODING: Record<DmeLaterality, Coding> = {
  LT: { system: SNOMED_CODE_SYSTEM, code: '7771000', display: 'Left' },
  RT: { system: SNOMED_CODE_SYSTEM, code: '24028007', display: 'Right' },
  BI: { system: SNOMED_CODE_SYSTEM, code: '51440002', display: 'Right and left' },
  NA: { system: NULL_FLAVOR_SYSTEM, code: 'NA', display: 'not applicable' },
};

const UCUM_SYSTEM = 'http://unitsofmeasure.org';
const DURATION_UCUM: Record<DmeDurationUnit, { code: string; unit: string }> = {
  days: { code: 'd', unit: 'day' },
  weeks: { code: 'wk', unit: 'week' },
};

const DISPENSED_BY = 'by';
const DISPENSED_AT = 'at';

// ---- DME menu ----

export const makeDmeMenuItemActivityDefinition = (
  input: { name: string; hcpcsCodes: { code: string; display: string }[] },
  id?: string
): ActivityDefinition => {
  const title = input.name.trim();
  return {
    resourceType: 'ActivityDefinition',
    ...(id ? { id } : {}),
    meta: { tag: [{ system: DME_MENU_ITEM_TAG_SYSTEM, code: DME_MENU_ITEM_TAG_CODE }] },
    status: 'active',
    kind: 'DeviceRequest',
    name: title.replace(/[^a-zA-Z0-9]/g, '_'),
    title,
    productCodeableConcept: input.hcpcsCodes.length
      ? { coding: input.hcpcsCodes.map((c) => ({ system: CODE_SYSTEM_CPT, code: c.code, display: c.display })) }
      : undefined,
  };
};

// A billing line needs a description; codes saved without one fall back to the item name, as in-house labs do.
const toBillingCode = (coding: Coding, fallbackDisplay: string): CPTCodeDTO => ({
  code: coding.code!,
  display: coding.display?.trim() || fallbackDisplay,
});

export const parseDmeMenuItem = (resource: ActivityDefinition): DmeMenuItem | undefined => {
  const { id, title } = resource;
  if (!id || !title) return undefined;
  return {
    id,
    name: title,
    hcpcsCodes: (resource.productCodeableConcept?.coding ?? [])
      .filter((c) => c.code)
      .map((c) => toBillingCode(c, title)),
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
    identifier: thirdParty.name ? undefined : [{ system: DME_THIRD_PARTY_IDENTIFIER_SYSTEM, value: 'external' }],
    name: thirdParty.name || undefined,
    address: thirdParty.address ? [{ text: thirdParty.address }] : undefined,
    telecom: telecom.length ? telecom : undefined,
  };
};

const hasThirdPartyDetails = (thirdParty: DmeThirdParty | undefined): thirdParty is DmeThirdParty =>
  !!thirdParty && Object.values(thirdParty).some((v) => !!v?.trim());

// R4 DeviceRequest has no quantity, laterality or modifier element, so they travel as parameters.
const makeParameters = (fields: ParsedDmeOrderFields): DeviceRequestParameter[] => {
  const params: DeviceRequestParameter[] = [
    { code: { coding: [QUANTITY_PARAMETER] }, valueQuantity: { value: fields.quantity } },
  ];
  if (fields.laterality) {
    params.push({
      code: { coding: [LATERALITY_PARAMETER] },
      valueCodeableConcept: { coding: [LATERALITY_CODING[fields.laterality]] },
    });
  }
  if (fields.modifier) {
    params.push({
      code: { coding: [MODIFIER_PARAMETER] },
      valueCodeableConcept: {
        coding: [
          { system: CODE_SYSTEM_CPT_MODIFIER, code: fields.modifier, display: DME_MODIFIER_LABELS[fields.modifier] },
        ],
      },
    });
  }
  return params;
};

const makeDurationOfUse = (duration: ParsedDmeOrderFields['duration']): Timing | undefined =>
  duration && {
    repeat: {
      boundsDuration: {
        value: duration.value,
        unit: DURATION_UCUM[duration.unit].unit,
        system: UCUM_SYSTEM,
        code: DURATION_UCUM[duration.unit].code,
      },
    },
  };

/** Builds the order content; status, dispensed info and identity are carried over from `existing` on edit. */
export const makeDmeDeviceRequest = (input: {
  fields: ParsedDmeOrderFields;
  encounterId: string;
  patientId: string;
  existing?: DeviceRequest;
  /** `Procedure/<id>` or the urn:uuid fullUrl of each billing Procedure written with this version of the order */
  billingProcedureReferences?: string[];
}): DeviceRequest => {
  const { fields, encounterId, patientId, existing, billingProcedureReferences = [] } = input;
  const external = fields.external;
  const thirdParty = external && hasThirdPartyDetails(fields.thirdParty) ? fields.thirdParty : undefined;

  const extension: Extension[] = [
    { url: DME_FULFILLMENT_EXTENSION_URL, valueCode: external ? 'external' : 'in-house' },
    ...fields.billingCodes.map((c) => ({
      url: DME_BILLING_CODE_EXTENSION_URL,
      valueCoding: { system: CODE_SYSTEM_CPT, code: c.code, display: c.display },
    })),
    ...billingProcedureReferences.map((reference) => ({
      url: DME_BILLING_PROCEDURE_EXTENSION_URL,
      valueReference: { reference },
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
    occurrenceTiming: makeDurationOfUse(fields.duration),
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

/** One billing Procedure per HCPCS code for in-house orders; third-party fulfillment is billed by the vendor. */
export const makeDmeBillingProcedures = (input: {
  fields: ParsedDmeOrderFields;
  encounterId: string;
  patientId: string;
  /** `DeviceRequest/<id>`, or the order's urn:uuid fullUrl when created in the same transaction */
  deviceRequestReference: string;
}): Procedure[] => {
  const { fields, encounterId, patientId, deviceRequestReference } = input;
  if (fields.external) return [];
  const modifier = billingModifiers(fields);
  return fields.billingCodes.map((c) => ({
    ...makeProcedureResource(
      encounterId,
      patientId,
      { code: c.code, display: c.display, modifier, billableUnits: fields.quantity },
      'cpt-code'
    ),
    extension: [{ url: DME_BILLED_ORDER_EXTENSION_URL, valueReference: { reference: deviceRequestReference } }],
  }));
};

export const isDmeBillingProcedure = (resource: { extension?: Extension[] }): boolean =>
  !!resource.extension?.some((e) => e.url === DME_BILLED_ORDER_EXTENSION_URL);

export const getDmeBillingProcedureIds = (deviceRequest: DeviceRequest): string[] =>
  (deviceRequest.extension ?? [])
    .filter((e) => e.url === DME_BILLING_PROCEDURE_EXTENSION_URL)
    .map((e) => removePrefix('Procedure/', e.valueReference?.reference ?? ''))
    .filter((id): id is string => !!id);

export const isDmeBillingProcedureOf = (procedure: Procedure, deviceRequest: DeviceRequest): boolean =>
  (!!procedure.id && getDmeBillingProcedureIds(deviceRequest).includes(procedure.id)) ||
  !!procedure.extension?.some(
    (e) =>
      e.url === DME_BILLED_ORDER_EXTENSION_URL && e.valueReference?.reference === `DeviceRequest/${deviceRequest.id}`
  );

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
  const who = `Practitioner/${callerPractitionerId}`;
  return {
    resourceType: 'Provenance',
    activity: { coding: [{ system: PROVENANCE_ACTIVITY_TYPE_SYSTEM, code, display: code.toLowerCase() }] },
    target: [{ reference: target }],
    recorded: new Date().toISOString(),
    agent: [
      {
        who: { reference: who },
        ...(requesterReference && requesterReference !== who ? { onBehalfOf: { reference: requesterReference } } : {}),
      },
    ],
  };
};

const getParam = (dr: DeviceRequest, code: Coding): DeviceRequestParameter | undefined =>
  dr.parameter?.find((p) => p.code?.coding?.some((c) => c.system === code.system && c.code === code.code));

const getParamValueCode = (dr: DeviceRequest, code: Coding, valueSystem: string): string | undefined =>
  getParam(dr, code)?.valueCodeableConcept?.coding?.find((c) => c.system === valueSystem)?.code;

const parseLaterality = (dr: DeviceRequest): DmeLaterality | undefined => {
  const codings = getParam(dr, LATERALITY_PARAMETER)?.valueCodeableConcept?.coding ?? [];
  return DME_LATERALITY_OPTIONS.find((side) =>
    codings.some((c) => c.system === LATERALITY_CODING[side].system && c.code === LATERALITY_CODING[side].code)
  );
};

const parseDurationOfUse = (dr: DeviceRequest): DmeOrderDTO['duration'] => {
  const bounds = dr.occurrenceTiming?.repeat?.boundsDuration;
  if (!bounds?.value || bounds.system !== UCUM_SYSTEM) return undefined;
  const unit = DME_DURATION_UNITS.find((u) => DURATION_UCUM[u].code === bounds.code);
  return unit ? { value: bounds.value, unit } : undefined;
};

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
  const dispensed = getDmeDispensed(dr);
  const itemName = dr.codeCodeableConcept?.text ?? dr.codeCodeableConcept?.coding?.[0]?.display ?? '';
  const billingCodes: CPTCodeDTO[] = (dr.extension ?? [])
    .filter((e) => e.url === DME_BILLING_CODE_EXTENSION_URL && e.valueCoding?.code)
    .map((e) => toBillingCode(e.valueCoding!, itemName));

  return {
    id: dr.id ?? '',
    encounterId: dr.encounter?.reference?.replace('Encounter/', '') ?? '',
    menuItemId: dr.codeCodeableConcept?.coding?.find((c) => c.system === DME_ITEM_CODE_SYSTEM)?.code,
    itemName,
    diagnoses: (dr.reasonCode ?? [])
      .map((rc) => rc.coding?.[0])
      .filter((c) => c?.code)
      .map((c) => ({ code: c!.code!, display: c!.display ?? '' })),
    quantity: getParam(dr, QUANTITY_PARAMETER)?.valueQuantity?.value ?? 1,
    billingCodes,
    laterality: parseLaterality(dr),
    modifier: oneOf<DmeModifier>(
      DME_MODIFIER_OPTIONS,
      getParamValueCode(dr, MODIFIER_PARAMETER, CODE_SYSTEM_CPT_MODIFIER)
    ),
    duration: parseDurationOfUse(dr),
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
