import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Button, Grid, Paper, Skeleton, Tab, Typography } from '@mui/material';
import { Address, Extension, Location, Practitioner } from 'fhir/r4';
import { ReactElement, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import Schedule from '../components/schedule/Schedule';
import { getName } from '../components/ScheduleInformation';
import Loading from '../components/Loading';

const START_SCHEDULE =
  '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}';

export default function SchedulePage(): ReactElement {
  // Define variables to interact w database and navigate to other pages
  const { fhirClient } = useApiClients();
  const scheduleType = useParams()['schedule-type'];
  const id = useParams().id as string;

  // state variables
  const [tabName, setTabName] = useState('schedule');
  const [item, setItem] = useState<Location | Practitioner | undefined>(undefined);

  // get the location from the database
  useEffect(() => {
    async function getItem(schedule: 'Location' | 'Practitioner'): Promise<void> {
      if (!fhirClient) {
        return;
      }
      const itemTemp = (await fhirClient.readResource({
        resourceType: schedule,
        resourceId: id,
      })) as any;
      setItem(itemTemp);
    }
    if (scheduleType === 'office') {
      void getItem('Location');
    } else if (scheduleType === 'provider') {
      void getItem('Practitioner');
    }
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

  return (
    <PageContainer>
      <>
        {item ? (
          <Box marginX={12}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/offices', children: 'Offices' },
                { link: '#', children: getName(item) || <Skeleton width={150} /> },
              ]}
            />

            {/* Page title */}
            <Typography variant="h3" color="primary.dark" marginTop={1}>
              {getName(item)}
            </Typography>
            {/* Address line */}
            <Typography marginBottom={1} fontWeight={400}>
              {item.resourceType === 'Location'
                ? item.address && addressStringFromAddress(item.address)
                : item.address && addressStringFromAddress(item.address[0])}
            </Typography>
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
                  {item.extension?.find(
                    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
                  )?.valueString ? (
                    <Schedule id={id} item={item} setItem={setItem}></Schedule>
                  ) : (
                    <Typography variant="body1">
                      This {scheduleType} doesn&apos;t have a schedule.{' '}
                      <Button type="button" variant="contained" onClick={createSchedule}>
                        Create a new schedule
                      </Button>
                    </Typography>
                  )}
                </TabPanel>
                {/* General tab */}
                <TabPanel value="general">
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
