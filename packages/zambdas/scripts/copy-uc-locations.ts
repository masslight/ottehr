import { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Practitioner, PractitionerRole } from 'fhir/r4b';
import fs from 'fs';
import { getAuth0Token } from '../src/shared';
import { createOystehrClient } from '../src/shared/helpers';

const directorsAreSame = (practitioner1: Practitioner, practitioner2: Practitioner | undefined): boolean => {
  if (!practitioner1 || !practitioner2) {
    throw new Error('bad practitioner');
  }
  const id1 = practitioner1?.identifier?.find((id) => {
    return id.system === 'http://hl7.org.fhir/sid/us-npi' || id.system === 'http://hl7.org/fhir/sid/us-npi';
  })?.value;
  const id2 = practitioner2?.identifier?.find((id) => {
    return id.system === 'http://hl7.org.fhir/sid/us-npi' || id.system === 'http://hl7.org/fhir/sid/us-npi';
  })?.value;

  const firstName1 = practitioner1?.name?.[0]?.given?.[0];
  const firstName2 = practitioner2?.name?.[0]?.given?.[0];
  const lastName1 = practitioner1?.name?.[0]?.family;
  const lastName2 = practitioner2?.name?.[0]?.family;

  if (id1 === id2) {
    if (firstName1 !== firstName2 || lastName1 !== lastName2) {
      console.log('weird case', firstName1, firstName2);
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
};

const getDirectorNPIUpdates = (practitioner: Practitioner): BatchInputPutRequest<Practitioner>[] => {
  const putRequests: BatchInputPutRequest<Practitioner>[] = [];
  const id1 = practitioner?.identifier?.find((id) => {
    return id.system === 'http://hl7.org.fhir/sid/us-npi';
  });

  if (id1) {
    const newIds = practitioner?.identifier?.map((id) => {
      if (id.system === 'http://hl7.org.fhir/sid/us-npi') {
        return {
          ...id,
          system: 'http://hl7.org/fhir/sid/us-npi',
        };
      } else {
        return id;
      }
    });
    putRequests.push({
      method: 'PUT',
      url: `Practitioner/${practitioner.id}`,
      resource: {
        ...practitioner,
        identifier: newIds,
      },
    });
  }
  return putRequests;
};

const filterDirectorListForInclusion = (listToFilter: Practitioner[], sourceList: Practitioner[]): Practitioner[] => {
  return listToFilter.filter((pract) => {
    return sourceList.some((sp) => directorsAreSame(pract, sp));
  });
};

const copyLocations = async (fromConfig: any, toConfig: any, isDryRun = true): Promise<void> => {
  const fromEnvToken = await getAuth0Token(fromConfig);
  const toEnvToken = await getAuth0Token(toConfig);

  if (!fromEnvToken || !toEnvToken) {
    throw new Error('Failed to fetch auth token.');
  }

  const sourceEnvOystehrClient = createOystehrClient(fromEnvToken, fromConfig);
  const destinationEnvOystehrClient = createOystehrClient(toEnvToken, toConfig);
  const locationsToCreate: BatchInputPostRequest<Location>[] = [];
  const locationsToUpdate: BatchInputPutRequest<Location>[] = [];
  const directorsToUpdate: BatchInputPutRequest<Practitioner>[] = [];
  const rolesToUpdate: BatchInputPutRequest<PractitionerRole>[] = [];
  const rolesToCreate: BatchInputPostRequest<PractitionerRole>[] = [];
  const sourceRolesToUpdate: BatchInputPutRequest<PractitionerRole>[] = [];
  const sourceRolesToCreate: BatchInputPostRequest<PractitionerRole>[] = [];

  try {
    const fromEnvUCLocs = (
      await sourceEnvOystehrClient.fhir.search<Location>({
        resourceType: 'Location',
      })
    )
      .unbundle()
      .filter((loc) => {
        return !loc.extension?.some((ext) => {
          // filter out telemed locations
          return ext.valueCoding?.code === 'vi';
        });
      });

    const toEnvUCLocs = (
      await destinationEnvOystehrClient.fhir.search<Location>({
        resourceType: 'Location',
      })
    )
      .unbundle()
      .filter((loc) => {
        return !loc.extension?.some((ext) => {
          // filter out telemed locations
          return ext.valueCoding?.code === 'vi';
        });
      });

    const sourceDirectorRolesAndPracts = (
      await sourceEnvOystehrClient.fhir.search<PractitionerRole | Practitioner>({
        resourceType: 'PractitionerRole',
        params: [
          {
            name: 'identifier',
            value: 'https://fhir.ottehr.com/r4/practitioner-role|ip-medical-director',
          },
          {
            name: 'location.identifier',
            value: `https://fhir.ottehr.com/r4/facility-name|`,
          },
          {
            name: '_include',
            value: 'PractitionerRole:practitioner',
          },
        ],
      })
    ).unbundle();
    const destinationDirectorRolesAndPracts = (
      await destinationEnvOystehrClient.fhir.search<PractitionerRole | Practitioner>({
        resourceType: 'PractitionerRole',
        params: [
          {
            name: 'identifier',
            value: 'https://fhir.ottehr.com/r4/practitioner-role|ip-medical-director',
          },
          {
            name: 'location.identifier',
            value: `https://fhir.ottehr.com/r4/facility-name|`,
          },
          {
            name: '_include',
            value: 'PractitionerRole:practitioner',
          },
        ],
      })
    ).unbundle();

    const sourceDirectorRoles = sourceDirectorRolesAndPracts.filter(
      (res) => res.resourceType === 'PractitionerRole'
    ) as PractitionerRole[];
    const sourceDirectors = sourceDirectorRolesAndPracts.filter(
      (res) => res.resourceType === 'Practitioner'
    ) as Practitioner[];

    const destinationDirectorRoles = destinationDirectorRolesAndPracts.filter(
      (res) => res.resourceType === 'PractitionerRole'
    ) as PractitionerRole[];
    let destinationDirectors = destinationDirectorRolesAndPracts.filter(
      (res) => res.resourceType === 'Practitioner'
    ) as Practitioner[];
    destinationDirectors = filterDirectorListForInclusion(destinationDirectors, sourceDirectors);

    console.log('from env IP Locs', fromEnvUCLocs.length);
    console.log('to env IP Locs', toEnvUCLocs.length);
    console.log('from env director roles', sourceDirectorRoles.length);
    console.log('to env director roles', destinationDirectorRoles.length);
    console.log('from env directors', sourceDirectors.length);
    console.log('to env directors', destinationDirectors.length);

    fromEnvUCLocs.forEach(async (sourceLoc) => {
      const sourceDirectorRole = sourceDirectorRoles.find(
        (role) => role.location?.[0]?.reference === `Location/${sourceLoc.id}`
      );
      const sourceDirector = sourceDirectors.find(
        (dir) => sourceDirectorRole?.practitioner?.reference === `Practitioner/${dir.id}`
      );
      const targLoc = toEnvUCLocs.find((loc) => {
        return loc.name === sourceLoc.name && loc.address?.state && loc.address?.state === sourceLoc?.address?.state;
      });
      if (targLoc) {
        locationsToUpdate.push({
          resource: {
            ...targLoc,
            extension: sourceLoc.extension,
          },
          method: 'PUT',
          url: `Location/${targLoc.id}`,
        });
        let destDirectorRole = destinationDirectorRoles.find(
          (role) => role.location?.[0]?.reference === `Location/${targLoc.id}`
        );
        if (!destDirectorRole) {
          destDirectorRole = await destinationEnvOystehrClient.fhir.create<PractitionerRole>({
            resourceType: 'PractitionerRole',
            location: [
              {
                reference: `Location/${targLoc.id}`,
              },
            ],
          });
        }
        if (!destDirectorRole) {
          console.log('dest director role missing', targLoc.name);
          throw new Error('director role missing');
        }
        const destDirector = destinationDirectors.find(
          (dir) => destDirectorRole?.practitioner?.reference === `Practitioner/${dir.id}`
        );
        if (!sourceDirector || !destDirector) {
          if (!sourceDirector) {
            console.log(`source director missing for ${sourceLoc.name} - skipping`);
          } else {
            const practiontionerToUse = destinationDirectors.find((dd) => directorsAreSame(dd, sourceDirector));
            console.log('linking practitioner to role for ', targLoc.name);
            rolesToUpdate.push({
              method: 'PUT',
              url: `PractitionerRole/${destDirectorRole.id}`,
              resource: {
                ...destDirectorRole,
                practitioner: { reference: `Practitioner/${practiontionerToUse?.id}` },
              },
            });
          }
        } else {
          if (directorsAreSame(sourceDirector, destDirector)) {
            console.log('directors same, no update needed');
            const alreadyAdded = directorsToUpdate.some((update) => {
              return update.resource.id === destDirector.id;
            });
            if (!alreadyAdded) {
              directorsToUpdate.push(...getDirectorNPIUpdates(destDirector));
            }
          } else {
            // no cases of this observed...
            console.log('directors different, update needed', targLoc.name);
          }
        }
      } else {
        const fullUrl = `urn:uuid:${randomUUID()}`;
        locationsToCreate.push({
          method: 'POST',
          url: 'Location',
          fullUrl,
          resource: {
            ...sourceLoc,
            id: undefined,
          },
        });
        let practiontionerToUse: Practitioner | undefined;
        if (sourceDirector) {
          practiontionerToUse = destinationDirectors.find((dd) => directorsAreSame(dd, sourceDirector));
        } else if (sourceDirectorRole) {
          const randomIdx = Math.round(Math.random() * 100) % destinationDirectors.length;
          console.log('randomIdx', randomIdx);
          practiontionerToUse = destinationDirectors[randomIdx];

          const sourceDir = sourceDirectors.find((dir) => directorsAreSame(dir, practiontionerToUse));
          sourceRolesToUpdate.push({
            method: 'PUT',
            url: `PractitionerRole/${sourceDirectorRole?.id}`,
            resource: {
              ...(sourceDirectorRole ?? {}),
              practitioner: { reference: `Practitioner/${sourceDir?.id}` },
            },
          });
        } else {
          console.log('source director role missing', sourceLoc.name);
          const randomIdx = Math.round(Math.random() * 100) % destinationDirectors.length;
          practiontionerToUse = destinationDirectors[randomIdx];
          const sourceDir = sourceDirectorRoles[randomIdx];
          sourceRolesToCreate.push({
            resource: {
              resourceType: 'PractitionerRole',
              location: [
                {
                  reference: `Location/${sourceLoc.id}`,
                },
              ],
              practitioner: { reference: `Practitioner/${sourceDir.id}` },
            },
            method: 'POST',
            url: 'PractitionerRole',
          });
        }

        rolesToCreate.push({
          method: 'POST',
          url: 'PractitionerRole',
          resource: {
            resourceType: 'PractitionerRole',
            location: [{ reference: fullUrl }],
            practitioner: { reference: `Practitioner/${practiontionerToUse?.id}` },
          },
        });
      }
    });

    if (isDryRun) {
      console.log('locations to create', locationsToCreate.length);
      console.log('locations to update', locationsToUpdate.length);
      console.log('roles to create', rolesToCreate.length);
      console.log('roles to update', rolesToUpdate.length);
      console.log('directors to update', directorsToUpdate.length);
      console.log('source director roles to update', sourceRolesToUpdate.length);
      console.log('source director roles to create', sourceRolesToCreate.length);
    } else {
      await destinationEnvOystehrClient.fhir.transaction<Location | Practitioner | PractitionerRole>({
        requests: [
          ...locationsToCreate,
          ...locationsToUpdate,
          ...directorsToUpdate,
          ...rolesToCreate,
          ...rolesToUpdate,
        ],
      });
      console.log('successfully updated/created destination locations');
      await sourceEnvOystehrClient.fhir.transaction({ requests: [...sourceRolesToUpdate, ...sourceRolesToCreate] });
      console.log('successfully updated source roles');
    }
  } catch (e) {
    console.log('copy loc failed: ', JSON.stringify(e));
  }
};

// So we can use await
const main = async (): Promise<void> => {
  const fromEnv = process.argv[2] ?? 'staging';
  const toEnv = process.argv[3] ?? 'testing';
  const dryRun = process.argv[4] ?? 'false';

  const fromSecrets = JSON.parse(fs.readFileSync(`.env/${fromEnv}.json`, 'utf8'));
  const toSecrets = JSON.parse(fs.readFileSync(`.env/${toEnv}.json`, 'utf8'));
  const isDryRun = dryRun === 'dry';
  await copyLocations(fromSecrets, toSecrets, isDryRun);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
