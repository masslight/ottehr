import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import { Autocomplete, Box, Button, Grid, Paper, Skeleton, Switch, Tab, TextField, Typography } from '@mui/material';
import { Address, Extension, HealthcareService, Identifier, Location, Practitioner } from 'fhir/r4';
import { ReactElement, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import Schedule from '../components/schedule/Schedule';
import { getName } from '../components/ScheduleInformation';
import Loading from '../components/Loading';
import GroupSchedule from '../components/schedule/GroupSchedule';
import { Operation } from 'fast-json-patch';
import { getTimezone } from '../helpers/formatDateTime';
import { getResource } from '../helpers/schedule';
import { TIMEZONES, TIMEZONE_EXTENSION_URL } from '../constants';

const START_SCHEDULE =
  '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}';
const IDENTIFIER_SLUG = 'https://fhir.ottehr.com/r4/slug';

export default function SchedulePage(): ReactElement {
  // Define variables to interact w database and navigate to other pages
  const { fhirClient } = useApiClients();
  const scheduleType = useParams()['schedule-type'] as 'office' | 'provider' | 'group';
  const id = useParams().id as string;

  if (!scheduleType) {
    throw new Error('scheduleType is not defined');
  }

  // state variables
  const [tabName, setTabName] = useState('schedule');
  const [item, setItem] = useState<Location | Practitioner | HealthcareService | undefined>(undefined);
  const [isItemActive, setIsItemActive] = useState<boolean>(false);
  const [slug, setSlug] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string | undefined>(undefined);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);

  const isActive = (item: Location | Practitioner | HealthcareService): boolean => {
    if (item.resourceType === 'Location') {
      return item.status === 'active';
    } else {
      return item.active || false;
    }
  };

  // get the location from the database
  useEffect(() => {
    async function getItem(schedule: 'Location' | 'Practitioner' | 'HealthcareService'): Promise<void> {
      if (!fhirClient) {
        return;
      }
      const itemTemp: Location | Practitioner | HealthcareService = (await fhirClient.readResource({
        resourceType: schedule,
        resourceId: id,
      })) as any;
      setItem(itemTemp);
      const slugTemp = itemTemp?.identifier?.find((identifierTemp) => identifierTemp.system === IDENTIFIER_SLUG);
      setSlug(slugTemp?.value);
      setTimezone(getTimezone(itemTemp));
      setIsItemActive(isActive(itemTemp));
    }
    void getItem(getResource(scheduleType));
  }, [fhirClient, id, scheduleType]);

  // utility functions
  const addressStringFromAddress = (address: Address): string => {
    let addressString = '';
    if (address.line) {
      addressString += `, ${address.line}`;
    }
    if (address.city) {
      addressString += `, ${address.city}`;
    }
    if (address.state) {
      addressString += `, ${address.state}`;
    }
    if (address.postalCode) {
      addressString += `, ${address.postalCode}`;
    }
    // return without trailing comma

    if (addressString !== '') {
      addressString = addressString.substring(2);
    }
    return addressString;
  };

  // handle functions
  const handleTabChange = (event: React.SyntheticEvent, newTabName: string): void => {
    setTabName(newTabName);
  };

  const getStatusOperationJSON = (
    resourceType: 'Location' | 'Practitioner' | 'HealthcareService',
    active: boolean,
  ): Operation => {
    // get the status operation json, account for cases where it exists already or does not
    let operation: Operation;
    if (resourceType === 'Location') {
      operation = {
        op: 'add',
        path: '/status',
        value: active ? 'active' : 'inactive',
      };
    } else if (resourceType === 'Practitioner' || resourceType === 'HealthcareService') {
      operation = {
        op: 'add',
        path: '/active',
        value: active,
      };
    } else {
      throw new Error('resourceType is not defined');
    }
    return operation;
  };

  async function createSchedule(): Promise<void> {
    let resourceType;
    if (!fhirClient) {
      return;
    }
    if (scheduleType === 'office') {
      resourceType = 'Location';
    } else if (scheduleType === 'provider') {
      resourceType = 'Practitioner';
    }
    if (!resourceType) {
      console.log('resourceType is not defined');
      throw new Error('resourceType is not defined');
    }
    const scheduleExtension: Extension[] = [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
        valueString: START_SCHEDULE,
      },
    ];

    // if there is no timezone extension, add it. The default timezone is America/New_York
    if (!item?.extension?.some((ext) => ext.url === TIMEZONE_EXTENSION_URL)) {
      scheduleExtension.push({
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      });
    }

    const patchedResource = (await fhirClient.patchResource({
      resourceType,
      resourceId: id,
      operations: [
        {
          op: 'add',
          path: '/extension',
          value: scheduleExtension,
        },

        getStatusOperationJSON(resourceType as 'Location' | 'Practitioner', true),
      ],
    })) as Location;
    setItem(patchedResource);
  }

  async function onSave(event: any): Promise<void> {
    event.preventDefault();
    setSaveLoading(true);
    const identifiers = item?.identifier || [];
    // make a copy of identifier
    let identifiersTemp: Identifier[] | undefined = [...identifiers];
    const hasIdentifiers = identifiersTemp.length > 0;
    const hasSlug = item?.identifier?.find((identifierTemp) => identifierTemp.system === IDENTIFIER_SLUG);
    const removingSlug = !slug || slug === '';
    const updatedSlugIdentifier: Identifier = {
      system: IDENTIFIER_SLUG,
      value: slug,
    };

    let slugChanged = true;
    if (removingSlug && !hasSlug) {
      console.log('Removing slug but none set');
      slugChanged = false;
    } else if (removingSlug && hasSlug) {
      console.log('Removing slug from identifiers');
      const identifiersUpdated = item?.identifier?.filter(
        (identifierTemp) => identifierTemp.system !== IDENTIFIER_SLUG,
      );
      identifiersTemp = identifiersUpdated;
    } else if (!hasIdentifiers) {
      console.log('No identifiers, adding one');
      identifiersTemp = [updatedSlugIdentifier];
    } else if (hasIdentifiers && !hasSlug) {
      console.log('Has identifiers without a slug, adding one');
      identifiersTemp.push(updatedSlugIdentifier);
    } else if (hasIdentifiers && hasSlug) {
      console.log('Has identifiers with a slug, replacing one');
      const identifierIndex = item?.identifier?.findIndex(
        (identifierTemp) => identifierTemp.system === IDENTIFIER_SLUG,
      );

      if (identifierIndex !== undefined && identifiers) {
        identifiersTemp[identifierIndex] = updatedSlugIdentifier;
      }
    }
    const operation: Operation | undefined = slugChanged
      ? {
          op: !hasIdentifiers ? 'add' : 'replace',
          path: '/identifier',
          value: identifiersTemp,
        }
      : undefined;

    // update timezone
    let timezoneOperation: Operation | undefined;
    const timezoneExtensionIndex = item?.extension?.findIndex((ext) => ext.url === TIMEZONE_EXTENSION_URL);
    if (timezoneExtensionIndex !== undefined && timezoneExtensionIndex >= 0) {
      // if there is no change in timezone, do nothing
      if (item?.extension?.[timezoneExtensionIndex]?.valueString === timezone) {
        console.log('No change in timezone');
      }
      // if there is an existing timezone, replace it
      else {
        console.log('Replacing existing timezone');
        timezoneOperation = {
          op: 'replace',
          path: `/extension/${timezoneExtensionIndex}/valueString`,
          value: timezone,
        };
      }
    }
    // if there is no timezone, add one
    else {
      console.log('Adding new timezone');
      timezoneOperation = {
        op: 'add',
        path: '/extension',
        value: [
          {
            url: TIMEZONE_EXTENSION_URL,
            valueString: timezone,
          },
        ],
      };
    }

    const patchOperations: Operation[] = [operation, timezoneOperation].filter(
      (operation) => operation !== undefined,
    ) as Operation[];

    if (patchOperations.length === 0) {
      console.log('No operations to save');
      setSaveLoading(false);
      return;
    }

    const itemTemp = await fhirClient?.patchResource({
      resourceType: getResource(scheduleType),
      resourceId: id,
      operations: patchOperations,
    });

    setItem(itemTemp as Location | Practitioner | HealthcareService);
    setSaveLoading(false);
  }

  const setStatus = async (item: Location | Practitioner | HealthcareService, isActive: boolean): Promise<void> => {
    if (!fhirClient) {
      throw new Error('error getting fhir client');
    }

    if (!item.id) {
      throw new Error('item id is not defined');
    }

    if (item.resourceType === 'Location') {
      item.status = isActive ? 'active' : 'inactive';
    } else {
      item.active = isActive;
    }
    setItem(item);
    setIsItemActive(isActive);

    await fhirClient.patchResource({
      resourceType: item.resourceType,
      resourceId: item.id,
      operations: [getStatusOperationJSON(item.resourceType, isActive)],
    });
  };

  return (
    <PageContainer>
      <>
        {item ? (
          <Box>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/schedules', children: 'Schedules' },
                { link: '#', children: getName(item) || <Skeleton width={150} /> },
              ]}
            />

            {/* Page title */}
            <Typography variant="h3" color="primary.dark" marginTop={1}>
              {getName(item)}
            </Typography>
            {/* Address line */}
            {(item.resourceType === 'Location' || item.resourceType === 'Practitioner') && (
              <Typography marginBottom={1} fontWeight={400}>
                {item.resourceType === 'Location'
                  ? item.address && addressStringFromAddress(item.address)
                  : item.address && addressStringFromAddress(item.address[0])}
              </Typography>
            )}
            {/* Tabs */}
            <TabContext value={tabName}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <TabList onChange={handleTabChange} aria-label="Tabs">
                  <Tab label="Schedule" value="schedule" sx={{ textTransform: 'none', fontWeight: 700 }} />
                  <Tab label="General" value="general" sx={{ textTransform: 'none', fontWeight: 700 }} />
                </TabList>
              </Box>
              {/* Page Content */}
              {/* Time slots tab */}
              <Paper
                sx={{
                  marginTop: 2,
                  border: 'none',
                  boxShadow: 'none',
                  background: 'none',
                }}
              >
                <TabPanel value="schedule" sx={{ padding: 0 }}>
                  {scheduleType === 'group' && <GroupSchedule groupID={item.id || ''} />}
                  {['office', 'provider'].includes(scheduleType) &&
                    (item.extension?.find(
                      (extensionTemp) =>
                        extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
                    )?.valueString ? (
                      <Schedule id={id} item={item} setItem={setItem}></Schedule>
                    ) : (
                      <Typography variant="body1">
                        This {scheduleType} doesn&apos;t have a schedule.{' '}
                        <Button type="button" variant="contained" onClick={createSchedule}>
                          Create a new schedule
                        </Button>
                      </Typography>
                    ))}
                </TabPanel>
                {/* General tab */}
                <TabPanel value="general">
                  <Paper sx={{ marginBottom: 2, padding: 3 }}>
                    <Box display={'flex'} alignItems={'center'}>
                      <Switch checked={isItemActive} onClick={() => setStatus(item, !isItemActive)} />
                      <Typography>{isItemActive ? 'Active' : 'Inactive'}</Typography>
                    </Box>
                    <hr />
                    <br />

                    <form onSubmit={(event) => onSave(event)}>
                      <TextField
                        label="Slug"
                        value={slug}
                        onChange={(event) => setSlug(event.target.value)}
                        sx={{ width: '250px' }}
                      />
                      <br />
                      <Autocomplete
                        options={TIMEZONES}
                        renderInput={(params) => <TextField {...params} label="Timezone" />}
                        sx={{ marginTop: 2, width: '250px' }}
                        value={timezone}
                        onChange={(event, newValue) => {
                          if (newValue) {
                            setTimezone(newValue);
                          }
                        }}
                      />
                      <br />
                      <LoadingButton type="submit" loading={saveLoading} variant="contained" sx={{ marginTop: 2 }}>
                        Save
                      </LoadingButton>
                    </form>
                  </Paper>
                  <Paper sx={{ padding: 3 }}>
                    <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start">
                      <Grid item xs={6}>
                        <Typography variant="h4" color={'primary.dark'}>
                          Information to the patients
                        </Typography>
                        <Typography variant="body1" color="primary.dark" marginTop={1}>
                          This message will be displayed to the patients before they proceed with booking the visit.
                        </Typography>
                        <Box
                          marginTop={2}
                          sx={{
                            background: otherColors.locationGeneralBlue,
                            borderRadius: 1,
                          }}
                          padding={3}
                        >
                          <Typography color="primary.dark" variant="body1">
                            No description
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </TabPanel>
              </Paper>
            </TabContext>
          </Box>
        ) : (
          <Loading />
        )}
      </>
    </PageContainer>
  );
}
