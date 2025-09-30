import { Extension } from 'fhir/r4b';

export function makeProviderTypeExtension(providerType?: string, providerTypeText?: string): Extension[] | undefined {
  if (!providerType) return undefined;

  return [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/provider-type',
      valueCodeableConcept: {
        coding: [
          {
            system: 'provider-type',
            code: providerType,
            display: providerType,
          },
        ],
        text: providerTypeText || providerType,
      },
    },
  ];
}

export function getSuffixFromProviderTypeExtension(providerTypeExtension?: Extension[]): string[] | undefined {
  if (!providerTypeExtension || providerTypeExtension.length === 0) return undefined;

  const ext = providerTypeExtension.find(
    (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/provider-type'
  );
  if (!ext?.valueCodeableConcept) return undefined;

  const cc = ext.valueCodeableConcept;
  return [cc.text || cc.coding?.[0]?.display || cc.coding?.[0]?.code].filter(Boolean) as string[];
}
