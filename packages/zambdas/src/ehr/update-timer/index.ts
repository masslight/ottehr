import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter } from 'fhir/r4b';
import moment from 'moment';
import { createOystehrClient, getAuth0Token, getUser, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;

export const index = wrapHandler('update-timer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    let requestBody;
    try {
      requestBody = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
      if (requestBody.body) {
        requestBody = typeof requestBody.body === 'string' ? JSON.parse(requestBody.body) : requestBody.body;
      }
    } catch (e) {
      console.error('Failed to parse body:', e);
      throw new Error('Invalid request body format');
    }

    const { patientId, updateType, serviceType, interactiveCommunication, notes, currentTime, secondsElapsed } =
      requestBody;

    console.log('seconds elapsed:', secondsElapsed);

    if (!patientId || !updateType) {
      throw new Error('Missing required parameters: deviceId, updateType');
    }

    if (!serviceType) {
      throw new Error('Missing required parameters: serviceType');
    }

    if (!notes) {
      throw new Error('Missing required parameters: notes');
    }

    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);
    const userToken = input.headers.Authorization?.replace('Bearer ', '');
    const user = userToken && (await getUser(userToken, input.secrets));

    const encounterResults = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [
          {
            name: 'subject',
            value: `Patient/${patientId}`,
          },
          {
            name: 'status',
            value: 'in-progress',
          },
          {
            name: 'participant',
            value: `${user.profile}`,
          },
          {
            name: 'class',
            value: 'OBSENC',
          },
          {
            name: '_sort',
            value: '-date',
          },
          {
            name: '_total',
            value: 'accurate',
          },
          {
            name: '_count',
            value: '1',
          },
        ],
      })
    ).unbundle();
    console.log('encounterResults :', encounterResults);

    if (updateType === 'pause') {
      const updatedEncounterPause = {
        ...encounterResults[0],
        statusHistory: [
          ...(encounterResults[0]?.statusHistory || []),
          {
            status: 'onleave',
            period: {
              start: new Date().toISOString(),
            },
          },
        ],
        meta: {
          ...encounterResults[0]?.meta,
          lastUpdated: new Date().toISOString(),
        },
      };
      console.log('Updated encounter for pause:', JSON.stringify(updatedEncounterPause, null, 2));
      const encounter = await oystehr.fhir.update<any>(updatedEncounterPause);
      return lambdaResponse(200, {
        message: `Successfully paused timer value`,
        encounterResults: encounter,
      });
    } else if (updateType === 'resume') {
      const updatedEncounterResume = {
        ...encounterResults[0],
        statusHistory: [
          ...(encounterResults[0]?.statusHistory || []),
          {
            status: 'in-progress',
            period: {
              start: new Date().toISOString(),
            },
          },
        ],
        meta: {
          ...encounterResults[0]?.meta,
          lastUpdated: new Date().toISOString(),
        },
      };
      console.log('Updated encounter for resume:', JSON.stringify(updatedEncounterResume, null, 2));
      const encounter = await oystehr.fhir.update<any>(updatedEncounterResume);
      return lambdaResponse(200, {
        message: `Successfully resumed timer value`,
        encounterResults: encounter,
      });
    } else if (updateType === 'stop') {
      const statusHistory = encounterResults[0]?.statusHistory || [];

      const finalStatusHistory = [...statusHistory];

      if (finalStatusHistory.length > 0 && finalStatusHistory[finalStatusHistory.length - 1].status === 'in-progress') {
        finalStatusHistory.push({
          status: 'onleave',
          period: {
            start: new Date().toISOString(),
          },
        });
      }

      let totalTimeMs = 0;
      let currentStartTime: moment.Moment | null = null;

      for (let i = 0; i < finalStatusHistory.length; i++) {
        const entry = finalStatusHistory[i];

        if (entry.status === 'in-progress') {
          currentStartTime = moment(entry.period.start);
        } else if (entry.status === 'onleave' && currentStartTime) {
          const endTime = moment(entry.period.start);
          if (currentStartTime.isValid() && endTime.isValid()) {
            totalTimeMs += endTime.diff(currentStartTime);
          }
          currentStartTime = null;
        }
      }

      if (currentStartTime) {
        const endTime = currentTime ? moment(currentTime) : moment();
        if (currentStartTime.isValid() && endTime.isValid()) {
          totalTimeMs += endTime.diff(currentStartTime);
        }
      }

      const totalTimeSeconds = secondsElapsed;

      const userReference = user.profile;
      const updatedParticipants = (encounterResults[0]?.participant || []).map((participant: any) => {
        if (participant.individual?.reference === userReference) {
          const startTime = moment(participant.period.start);
          const endTime = startTime.clone().add(totalTimeMs, 'milliseconds');

          return {
            ...participant,
            period: {
              ...participant.period,
              end: endTime.toISOString(),
            },
          };
        }
        return participant;
      });

      const encounterStartTime =
        finalStatusHistory.length > 0 && finalStatusHistory[0].status === 'in-progress'
          ? finalStatusHistory[0].period.start
          : encounterResults[0]?.period?.start || new Date().toISOString();

      const encounterStartMoment = moment(encounterStartTime);
      const encounterEndTime = encounterStartMoment.clone().add(totalTimeMs, 'milliseconds').toISOString();

      const existingIdentifiers = encounterResults[0]?.identifier || [];

      const updatedIdentifiers = existingIdentifiers.filter(
        (id: any) =>
          id.system !== 'total-time' &&
          id.system !== 'service-type' &&
          id.system !== 'interactive-communication' &&
          id.system !== 'notes'
      );

      updatedIdentifiers.push({
        system: 'total-time',
        value: totalTimeSeconds.toString(),
      });

      if (serviceType) {
        updatedIdentifiers.push({
          system: 'service-type',
          value: serviceType.toString(),
        });
      }

      if (interactiveCommunication !== undefined) {
        updatedIdentifiers.push({
          system: 'interactive-communication',
          value: interactiveCommunication.toString(),
        });
      }

      if (notes) {
        updatedIdentifiers.push({
          system: 'notes',
          value: notes,
        });
      }
      const updatedEncounterStop = {
        ...encounterResults[0],
        status: 'finished',
        statusHistory: finalStatusHistory,
        participant: updatedParticipants,
        period: {
          start: encounterStartTime,
          end: encounterEndTime,
        },
        identifier: updatedIdentifiers,
        meta: {
          ...encounterResults[0]?.meta,
          lastUpdated: new Date().toISOString(),
        },
      };

      console.log('Updated encounter for stop:', JSON.stringify(updatedEncounterStop, null, 2));
      console.log(`Total time calculated: ${totalTimeSeconds} seconds`);
      console.log(`Service type: ${serviceType}`);
      console.log(`Interactive communication: ${interactiveCommunication}`);
      console.log(`Notes: ${notes}`);

      const encounter = await oystehr.fhir.update<any>(updatedEncounterStop);
      return lambdaResponse(200, {
        message: `Successfully stopped timer value with total time: ${totalTimeSeconds} seconds`,
        totalTime: totalTimeSeconds,
        serviceType: serviceType,
        interactiveCommunication: interactiveCommunication,
        notes: notes,
        encounterResults: encounter,
      });
    } else if (updateType === 'discard') {
      console.log('Discarded encounter for:', JSON.stringify(encounterResults[0].id, null, 2));
      const encounter = await oystehr.fhir.delete<any>({ resourceType: 'Encounter', id: encounterResults[0].id || '' });
      return lambdaResponse(200, {
        message: `Successfully discarded timer value`,
        id: encounterResults[0].id,
        encounterResults: encounter,
      });
    } else {
      return lambdaResponse(200, {
        message: `Successfully retrieved without stopping timer value`,
        encounterResults: encounterResults[0],
      });
    }
  } catch (error: any) {
    console.error('Error:', error);
    return lambdaResponse(500, {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
