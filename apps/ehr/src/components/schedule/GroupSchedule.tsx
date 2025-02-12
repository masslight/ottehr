import { ReactElement, useCallback, useEffect, useState } from 'react';
import { CircularProgress, Grid, Typography } from '@mui/material';
import { HealthcareService, Location, Practitioner, PractitionerRole, Resource } from 'fhir/r4b';
import GroupMembers from './GroupMembers';
import { useApiClients } from '../../hooks/useAppClients';
import { LoadingButton } from '@mui/lab';
import { getPatchBinary } from 'utils';
import { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';

interface GroupScheduleProps {
  groupID: string;
}

export default function GroupSchedule({ groupID }: GroupScheduleProps): ReactElement {
  const { oystehr } = useApiClients();
  const [group, setGroup] = useState<HealthcareService | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[] | undefined>(undefined);
  const [practitioners, setPractitioners] = useState<Practitioner[] | undefined>(undefined);
  const [practitionerRoles, setPractitionerRoles] = useState<PractitionerRole[] | undefined>(undefined);
  const [selectedLocations, setSelectedLocations] = useState<string[] | undefined>(undefined);
  const [selectedPractitioners, setSelectedPractitioners] = useState<string[] | undefined>(undefined);

  const getOptions = useCallback(async () => {
    if (!oystehr) {
      console.log('oystehr client is not defined');
      return;
    }
    const request = await oystehr.fhir.batch({
      requests: [
        {
          method: 'GET',
          url: `/HealthcareService?_id=${groupID}`,
        },
        {
          method: 'GET',
          url: '/Location',
        },
        {
          method: 'GET',
          url: '/Practitioner?_revinclude=PractitionerRole:practitioner',
        },
      ],
    });
    console.log(1, request);
    const groupTemp: HealthcareService = (request?.entry?.[0]?.resource as any).entry.map(
      (resourceTemp: any) => resourceTemp.resource
    )[0];
    const locationsTemp: Location[] = (request?.entry?.[1]?.resource as any).entry.map(
      (resourceTemp: any) => resourceTemp.resource
    );
    const practitionerResources: Resource[] = (request?.entry?.[2]?.resource as any).entry.map(
      (resourceTemp: any) => resourceTemp.resource
    );
    const practitionersTemp: Practitioner[] = practitionerResources.filter(
      (resourceTemp) => resourceTemp.resourceType === 'Practitioner'
    ) as Practitioner[];
    const practitionerRolesTemp: PractitionerRole[] = practitionerResources.filter(
      (resourceTemp) => resourceTemp.resourceType === 'PractitionerRole'
    ) as PractitionerRole[];
    console.log(request);
    setGroup(groupTemp);
    setLocations(locationsTemp);
    setPractitioners(practitionersTemp);
    setPractitionerRoles(practitionerRolesTemp);

    const selectedLocationsTemp = groupTemp.location?.map((location) => {
      if (!location.reference) {
        console.log('HealthcareService location does not have reference', location);
        throw new Error('HealthcareService location does not have reference');
      }
      return location.reference?.replace('Location/', '');
    });
    // console.log(group);
    setSelectedLocations(selectedLocationsTemp);

    const selectedPractitionerRolesTemp = practitionerRolesTemp?.filter(
      (practitionerRoleTemp) =>
        practitionerRoleTemp.healthcareService?.some(
          (healthcareServiceTemp) => healthcareServiceTemp.reference === `HealthcareService/${groupTemp.id}`
        )
    );
    const selectedPractitionersTemp = practitionersTemp.filter((practitionerTemp) =>
      selectedPractitionerRolesTemp.some(
        (selectedPractitionerRoleTemp) =>
          selectedPractitionerRoleTemp.practitioner?.reference === `Practitioner/${practitionerTemp.id}`
      )
    );
    setSelectedPractitioners(selectedPractitionersTemp.map((practitionerTemp) => practitionerTemp.id || ''));
  }, [oystehr, groupID]);

  useEffect(() => {
    void getOptions();
  }, [getOptions]);
  async function onSubmit(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehr) {
      console.log('oystehr client is not defined');
      return;
    }
    if (!selectedPractitioners || !practitionerRoles) {
      return;
    }
    setLoading(true);
    const practitionerRolePractitionerIDs = practitionerRoles?.map(
      (practitionerRoleTemp) => practitionerRoleTemp.practitioner?.reference
    );
    const practitionerIDToCreatePractitionerRoles = selectedPractitioners.filter(
      (selectedPractitionerTemp) =>
        !practitionerRolePractitionerIDs?.includes(`Practitioner/${selectedPractitionerTemp}`)
    );
    const practitionerIDToAddHealthcareServicePractitionerRoles = practitionerRoles.filter(
      (practitionerRoleTemp) =>
        selectedPractitioners.includes(
          practitionerRoleTemp.practitioner?.reference?.replace('Practitioner/', '') || ''
        ) &&
        !practitionerRoleTemp.healthcareService?.some(
          (healthcareServiceTemp) => healthcareServiceTemp.reference === `HealthcareService/${groupID}`
        )
    );
    const practitionerIDToRemoveHealthcareServicePractitionerRoles = practitionerRoles.filter(
      (practitionerRoleTemp) =>
        !selectedPractitioners.includes(
          practitionerRoleTemp.practitioner?.reference?.replace('Practitioner/', '') || ''
        ) &&
        practitionerRoleTemp.healthcareService?.some(
          (healthcareServiceTemp) => healthcareServiceTemp.reference === `HealthcareService/${groupID}`
        )
    );

    const practitionerRolesResourcesToCreate: PractitionerRole[] = practitionerIDToCreatePractitionerRoles?.map(
      (practitionerID) => ({
        resourceType: 'PractitionerRole',
        practitioner: {
          reference: `Practitioner/${practitionerID}`,
        },
        healthcareService: [
          {
            reference: `HealthcareService/${groupID}`,
          },
        ],
      })
    );
    const updateLocations: BatchInputRequest<HealthcareService> = getPatchBinary({
      resourceType: 'HealthcareService',
      resourceId: groupID,
      patchOperations: [
        {
          op: 'add',
          path: '/location',
          value: selectedLocations?.map((selectedLocationTemp) => ({
            reference: `Location/${selectedLocationTemp}`,
          })),
        },
      ],
    });
    const practitionerRolesResourceCreateRequests: BatchInputPostRequest<PractitionerRole>[] =
      practitionerRolesResourcesToCreate.map((practitionerRoleResourceToCreateTemp) => ({
        method: 'POST',
        url: '/PractitionerRole',
        resource: practitionerRoleResourceToCreateTemp,
      }));
    const practitionerRolesResourcePatchRequests: BatchInputRequest<PractitionerRole>[] =
      practitionerIDToAddHealthcareServicePractitionerRoles.map(
        (practitionerIDToAddHealthcareServicePractitionerRoleTemp) => {
          const practitionerRole = practitionerRoles?.find(
            (practitionerRoleTemp) => practitionerRoleTemp === practitionerIDToAddHealthcareServicePractitionerRoleTemp
          );
          let value: any = {
            reference: `HealthcareService/${groupID}`,
          };
          if (!practitionerRole?.healthcareService) {
            value = [value];
          }

          return getPatchBinary({
            resourceType: 'PractitionerRole',
            resourceId: practitionerIDToAddHealthcareServicePractitionerRoleTemp.id || '',
            patchOperations: [
              {
                op: 'add',
                path: practitionerRole?.healthcareService ? '/healthcareService/-' : '/healthcareService',
                value: value,
              },
            ],
          });
        }
      );
    practitionerRolesResourcePatchRequests.push(
      ...practitionerIDToRemoveHealthcareServicePractitionerRoles.map(
        (practitionerIDToRemoveHealthcareServicePractitionerRoleTemp) =>
          getPatchBinary({
            resourceType: 'PractitionerRole',
            resourceId: practitionerIDToRemoveHealthcareServicePractitionerRoleTemp.id || '',
            patchOperations: [
              {
                op: 'replace',
                path: '/healthcareService',
                value: practitionerRoles
                  ?.find(
                    (practitionerRoleTemp) =>
                      practitionerRoleTemp === practitionerIDToRemoveHealthcareServicePractitionerRoleTemp
                  )
                  ?.healthcareService?.filter(
                    (locationTemp) => locationTemp.reference !== `HealthcareService/${groupID}`
                  ),
              },
            ],
          })
      )
    );
    await oystehr.fhir.batch<PractitionerRole | HealthcareService>({
      requests: [
        ...practitionerRolesResourceCreateRequests,
        ...practitionerRolesResourcePatchRequests,
        updateLocations,
      ],
    });
    void (await getOptions());
    setLoading(false);
  }

  if (!group) {
    return (
      <div style={{ width: '100%', height: '250px' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <>
      <Typography variant="h4">Manage the schedule for {group?.name}</Typography>
      <Typography variant="body1">
        This is a group schedule. Its availability is made up of the schedules of the locations and providers selected.
      </Typography>
      <form onSubmit={onSubmit}>
        <Grid container spacing={4} sx={{ marginTop: 0 }}>
          <Grid item xs={6}>
            <GroupMembers
              option="locations"
              options={
                locations
                  ? locations.map((locationTemp) => ({
                      value: locationTemp.id || 'Undefined name',
                      label: locationTemp.name || 'Undefined name',
                    }))
                  : []
              }
              values={
                selectedLocations
                  ? selectedLocations?.map((locationTemp) => {
                      const locationName = locations?.find((location) => location.id === locationTemp)?.name;
                      return {
                        value: locationTemp,
                        label: locationName || 'Undefined name',
                      };
                    })
                  : []
              }
              onChange={(event, value) => setSelectedLocations(value.map((valueTemp: any) => valueTemp.value))}
            />
          </Grid>
          <Grid item xs={6}>
            <GroupMembers
              option="providers"
              options={
                practitioners
                  ? practitioners.map((practitionerTemp) => ({
                      value: practitionerTemp.id || 'Undefined name',
                      label: practitionerTemp.name
                        ? oystehr?.fhir.formatHumanName(practitionerTemp.name[0]) || 'Undefined name'
                        : 'Undefined name',
                    }))
                  : []
              }
              values={
                selectedPractitioners
                  ? selectedPractitioners.map((practitionerTemp) => {
                      const practitionerName = practitioners?.find(
                        (practitioner) => practitioner.id === practitionerTemp
                      )?.name?.[0];
                      return {
                        value: practitionerTemp,
                        label: practitionerName
                          ? oystehr?.fhir.formatHumanName(practitionerName) || 'Undefined name'
                          : 'Undefined name',
                      };
                    })
                  : []
              }
              onChange={(event, value) => setSelectedPractitioners(value.map((valueTemp: any) => valueTemp.value))}
            />
          </Grid>
          <Grid item xs={2}>
            <LoadingButton loading={loading} type="submit" variant="contained">
              Save
            </LoadingButton>
          </Grid>
        </Grid>
      </form>
    </>
  );
}
