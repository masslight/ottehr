import Oystehr, { OystehrConfig, User } from '@oystehr/sdk';
import { mapStatusToTelemed } from '../../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../../shared/helpers';
import { getPractLicensesLocationsAbbreviations } from '../helpers/fhir-utils';
import { mapQuestionnaireToEncountersIds } from '../helpers/mappers';
import {
  testVirtualLocationsMap,
  virtualPreVideoAppointment,
  virtualOnVideoAppointment,
  virtualUnsignedAppointment,
  virtualCompleteAppointment,
} from './test-data';
import {
  allLocations,
  allTestResources,
  appointmentWithoutVRExtension,
  completeEncounterMappedStatusHistory,
  encounterWithVRExtension,
  fullEncounterStatusHistory,
  myPractitioner,
  questionnaireForPreVideoEncounter,
  questionnaireForReadyEncounter,
  unsignedEncounterMappedStatusHistory,
  virtualPreVideoAppointmentEncounter,
  virtualReadyAppointment,
  virtualReadyAppointmentEncounter,
} from './test-data';
import { filterAppointmentsFromResources } from '../helpers/fhir-resources-filters';
import { mapEncounterStatusHistory } from 'utils';
import { vi } from 'vitest';

describe('Test "get-telemed-appointments" endpoint', () => {
  describe('Test "filterAppointmentsFromResources" function', () => {
    test('Map encounter statuses to telemed, success', async () => {
      let status = mapStatusToTelemed('planned', undefined);
      expect(status).toEqual('ready');

      status = mapStatusToTelemed('arrived', undefined);
      expect(status).toEqual('pre-video');

      status = mapStatusToTelemed('in-progress', undefined);
      expect(status).toEqual('on-video');

      status = mapStatusToTelemed('finished', undefined);
      expect(status).toEqual('unsigned');

      status = mapStatusToTelemed('finished', 'fulfilled');
      expect(status).toEqual('complete');

      status = mapStatusToTelemed('wrong', undefined);
      expect(status).toBeUndefined();
    });

    test('Get video room extension from appointment and encounter, success', async () => {
      let videoRoomExtension = getVideoRoomResourceExtension(virtualReadyAppointment);
      expect(videoRoomExtension).toBeDefined();

      videoRoomExtension = getVideoRoomResourceExtension(encounterWithVRExtension);
      expect(videoRoomExtension).toBeDefined();

      videoRoomExtension = getVideoRoomResourceExtension(appointmentWithoutVRExtension);
      expect(videoRoomExtension).toBeNull();
    });

    test('Filter appointments from all resources, success', async () => {
      let appointments = filterAppointmentsFromResources(allTestResources, ['ready'], testVirtualLocationsMap);
      expect(appointments[0].appointment).toEqual(virtualReadyAppointment);
      expect(appointments[0].paperwork).toEqual(questionnaireForReadyEncounter);

      appointments = filterAppointmentsFromResources(allTestResources, ['pre-video'], testVirtualLocationsMap);
      expect(appointments[0].appointment).toEqual(virtualPreVideoAppointment);
      expect(appointments[0].paperwork).toEqual(questionnaireForPreVideoEncounter);

      appointments = filterAppointmentsFromResources(allTestResources, ['on-video'], testVirtualLocationsMap);
      expect(appointments[0].appointment).toEqual(virtualOnVideoAppointment);

      appointments = filterAppointmentsFromResources(allTestResources, ['unsigned'], testVirtualLocationsMap);
      expect(appointments[0].appointment).toEqual(virtualUnsignedAppointment);

      appointments = filterAppointmentsFromResources(allTestResources, ['complete'], testVirtualLocationsMap);
      expect(appointments[0].appointment).toEqual(virtualCompleteAppointment);
    });
  });

  describe('Test "getAllLocationIds" function', () => {
    const CLIENT_CONFIG: OystehrConfig = {
      accessToken: 'a',
      fhirApiUrl: 'a',
      projectApiUrl: 'a',
    };
    const oystehr = new Oystehr(CLIENT_CONFIG);

    oystehr.user.me = vi.fn(() => {
      return new Promise<User>((resolve) => {
        resolve({
          id: '',
          name: '',
          email: '',
          phoneNumber: '',
          authenticationMethod: '',
          profile: '',
          accessPolicy: {
            rule: [{}],
          },
        });
      });
    });

    oystehr.fhir.get = vi.fn((): Promise<any> => {
      return new Promise((resolve) => {
        resolve(myPractitioner);
      });
    });

    oystehr.fhir.search = vi.fn((): Promise<any> => {
      return new Promise((resolve) => {
        resolve(allLocations as any);
      });
    });

    test('Getting practitioner license locations abbreviations, success', async () => {
      const abbreviations = await getPractLicensesLocationsAbbreviations(oystehr);
      expect(abbreviations).toEqual(['LA', 'NY']);
    });
  });

  describe('Questionnaire tests', () => {
    test('Test questionnaire to encounters mapping, success', async () => {
      const mapa = mapQuestionnaireToEncountersIds(allTestResources);

      expect(mapa[virtualReadyAppointmentEncounter.id!]).toEqual(questionnaireForReadyEncounter);
      expect(mapa[virtualPreVideoAppointmentEncounter.id!]).toEqual(questionnaireForPreVideoEncounter);
    });
  });

  describe('Encounter tests', () => {
    test('Test encounter status history mapping, success', async () => {
      let history = mapEncounterStatusHistory(fullEncounterStatusHistory, 'arrived');
      expect(history).toEqual(unsignedEncounterMappedStatusHistory);

      history = mapEncounterStatusHistory(fullEncounterStatusHistory, 'fulfilled');
      expect(history).toEqual(completeEncounterMappedStatusHistory);
    });
  });
});
