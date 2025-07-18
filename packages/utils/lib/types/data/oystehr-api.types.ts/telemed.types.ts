import { Extension } from 'fhir/r4b';

export interface OtherParticipantsExtension extends Extension {
  url: 'https://extensions.fhir.zapehr.com/encounter-other-participants';
  extension: OtherParticipantExtension[];
}

export interface OtherParticipantExtension extends Extension {
  url: 'https://extensions.fhir.zapehr.com/encounter-other-participant';
  extension: [
    {
      url: 'period';
      valuePeriod: {
        start: string;
      };
    },
    {
      url: 'reference';
      valueReference: {
        reference: string;
        display: string;
      };
    },
  ];
}

export interface EncounterVirtualServiceExtension {
  url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release';
  extension: [
    {
      url: 'channelType';
      valueCoding: {
        system: 'https://fhir.zapehr.com/virtual-service-type';
        code: string;
        display: string;
      };
    },
    {
      url: 'addressString';
      valueString: string;
    },
  ];
}
