import { AppClient, ClientConfig, FhirClient, User } from '@zapehr/sdk';
import { mapStatusToTelemed } from '../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../shared/helpers';
import { getPractLicensesLocationsAbbreviations } from '../helpers/fhir-utils';
import { mapEncounterStatusHistory, mapQuestionnaireToEncountersIds } from '../helpers/mappers';
import { groupAppointmentsLocations } from '../helpers/helpers';
import {
  allTestAppointmentsPackages,
  testVirtualLocationsMap,
  testSameEstimatedTimeStatesGroups,
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
    const CLIENT_CONFIG: ClientConfig = {
      apiUrl: 'a',
      accessToken: 'a',
    };
    const appClient = new AppClient(CLIENT_CONFIG);
    const fhirClient = new FhirClient(CLIENT_CONFIG);

    appClient.getMe = jest.fn(() => {
      return new Promise<User>((resolve) => {
        resolve({
          id: '',
          name: '',
          email: '',
          profile: '',
          accessPolicy: '',
        });
      });
    });
    fhirClient.readResource = jest.fn(() => {
      return new Promise((resolve) => {
        resolve(myPractitioner as any);
      });
    });
    fhirClient.searchResources = jest.fn(() => {
      return new Promise((resolve) => {
        resolve(allLocations as any);
      });
    });

    test('Getting practitioner license locations abbreviations, success', async () => {
      const abbreviations = await getPractLicensesLocationsAbbreviations(fhirClient, appClient);
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

  describe('Estimated time calculation tests', () => {
    test('Test function to group appointments locations using constant groups', async () => {
      const locationsGroups = groupAppointmentsLocations(
        allTestAppointmentsPackages,
        testVirtualLocationsMap,
        testSameEstimatedTimeStatesGroups,
      );

      const expectedResult = [
        ['6d3fe1c9-1ebe-4625-b3e7-66bfccb89385'],
        ['7143e392-7b37-4fe4-9c06-4faf6ec8a406'],
        ['d0cd35f6-82d2-41ec-8116-5cc91ec25904'],
        [
          '455b81fc-d67f-4fc2-9ed7-208a925f4d11',
          '70f9ae05-ab2b-473d-bdca-236de1b89ca6',
          'c006084d-d7b3-4cfa-9d6b-36a445cddd9b',
        ],
      ];
      expect(locationsGroups).toEqual(expectedResult);
    });
  });
});
