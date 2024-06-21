import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Button, Grid, Paper, Skeleton, Tab, TextField, Typography } from '@mui/material';
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

const START_SCHEDULE =
  '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}';
const IDENTIFIER_SLUG = 'https://fhir.ottehr.com/r4/slug';

export function getResource(
  scheduleType: 'office' | 'provider' | 'group',
): 'Location' | 'Practitioner' | 'HealthcareService' {
  if (scheduleType === 'office') {
    return 'Location';
  } else if (scheduleType === 'provider') {
    return 'Practitioner';
  } else if (scheduleType === 'group') {
    return 'HealthcareService';
  }

  console.log(`'scheduleType unknown ${scheduleType}`);
  throw new Error('scheduleType unknown');
}

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
  const [slug, setSlug] = useState<string | undefined>(undefined);
  const [slugLoading, setSlugLoading] = useState<boolean>(false);

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
    const patchedResource = (await fhirClient.patchResource({
      resourceType,
      resourceId: id,
      operations: [
        {
          op: 'add',
          path: '/extension',
          value: scheduleExtension,
        },
      ],
    })) as Location;
    setItem(patchedResource);
  }

  async function updateSlug(event: any): Promise<void> {
    event.preventDefault();
    setSlugLoading(true);
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

    if (removingSlug && !hasSlug) {
      console.log('Removing slug but none set');
      setSlugLoading(false);
      return;
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
    const operation: Operation = {
      op: !hasIdentifiers ? 'add' : 'replace',
      path: '/identifier',
      value: identifiersTemp,
    };

    const itemTemp = await fhirClient?.patchResource({
      resourceType: getResource(scheduleType),
      resourceId: id,
      operations: [operation],
    });
    setItem(itemTemp as Location | Practitioner | HealthcareService);
    setSlugLoading(false);
  }

  return (
    <PageContainer>
      <>
        {item ? (
          <Box marginX={12}>
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
                <TabPanel value="schedule">
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
                    <form onSubmit={(event) => updateSlug(event)}>
                      <TextField label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
                      <br />
                      <LoadingButton type="submit" loading={slugLoading} variant="contained" sx={{ marginTop: 2 }}>
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
