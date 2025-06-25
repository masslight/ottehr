import Oystehr, { OystehrConfig, User } from '@oystehr/sdk';
import { mapEncounterStatusHistory } from 'utils';
import { vi } from 'vitest';
import { mapStatusToTelemed } from '../../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../../shared/helpers';
import { filterAppointmentsAndCreatePackages } from '../helpers/fhir-resources-filters';
import { getPractitionerLicensesLocationsAbbreviations } from '../helpers/fhir-utils';
import { mapQuestionnaireToEncountersIds } from '../helpers/mappers';
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
  testVirtualLocationsMap,
  unsignedEncounterMappedStatusHistory,
  virtualCompleteAppointment,
  virtualOnVideoAppointment,
  virtualPreVideoAppointment,
  virtualPreVideoAppointmentEncounter,
  virtualReadyAppointment,
  virtualReadyAppointmentEncounter,
  virtualUnsignedAppointment,
} from './test-data';

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
      let appointments = filterAppointmentsAndCreatePackages({
        allResources: allTestResources,
        statusesFilter: ['ready'],
        virtualLocationsMap: testVirtualLocationsMap,
      });
      expect(appointments[0].appointment).toEqual(virtualReadyAppointment);
      expect(appointments[0].paperwork).toEqual(questionnaireForReadyEncounter);

      appointments = filterAppointmentsAndCreatePackages({
        allResources: allTestResources,
        statusesFilter: ['pre-video'],
        virtualLocationsMap: testVirtualLocationsMap,
      });
      expect(appointments[0].appointment).toEqual(virtualPreVideoAppointment);
      expect(appointments[0].paperwork).toEqual(questionnaireForPreVideoEncounter);

      appointments = filterAppointmentsAndCreatePackages({
        allResources: allTestResources,
        statusesFilter: ['on-video'],
        virtualLocationsMap: testVirtualLocationsMap,
      });
      expect(appointments[0].appointment).toEqual(virtualOnVideoAppointment);

      appointments = filterAppointmentsAndCreatePackages({
        allResources: allTestResources,
        statusesFilter: ['unsigned'],
        virtualLocationsMap: testVirtualLocationsMap,
      });
      expect(appointments[0].appointment).toEqual(virtualUnsignedAppointment);

      appointments = filterAppointmentsAndCreatePackages({
        allResources: allTestResources,
        statusesFilter: ['complete'],
        virtualLocationsMap: testVirtualLocationsMap,
      });
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
            rule: [],
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
      const abbreviations = await getPractitionerLicensesLocationsAbbreviations(oystehr);
      expect(abbreviations).toEqual(['LA', 'NY']);
    });
  });

  describe('Questionnaire tests', () => {
    test('Test questionnaire to encounters mapping, success', async () => {
      const mapAll = mapQuestionnaireToEncountersIds(allTestResources);

      expect(mapAll[virtualReadyAppointmentEncounter.id!]).toEqual(questionnaireForReadyEncounter);
      expect(mapAll[virtualPreVideoAppointmentEncounter.id!]).toEqual(questionnaireForPreVideoEncounter);
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
