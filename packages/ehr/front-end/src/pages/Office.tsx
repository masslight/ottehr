import { useParams } from 'react-router-dom';
import { ReactElement, useEffect, useState } from 'react';
import useFhirClient from '../hooks/useFhirClient';
import { Grid, Typography, Box, Paper, Tab, Skeleton } from '@mui/material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Address, Location } from 'fhir/r4';
import PageContainer from '../layout/PageContainer';
import { otherColors } from '../CustomThemeProvider';
import Schedule from './Schedule';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';

export default function LocationPage(): ReactElement {
  // Define variables to interact w database and navigate to other pages
  const fhirClient = useFhirClient();
  const id = useParams().id as string;

  // state variables
  const [tabName, setTabName] = useState('schedule');
  const [location, setLocation] = useState<Location>({} as Location);

  // get the location from the database
  useEffect(() => {
    async function getLocation(): Promise<void> {
      if (!fhirClient) {
        return;
      }

      const location: Location = await fhirClient.readResource({
        resourceType: 'Location',
        resourceId: id,
      });
      setLocation(location);
    }
    getLocation().catch((error) => console.log(error));
  }, [fhirClient, id]);

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

  return (
    <PageContainer>
      <>
        <Box marginX={12}>
          {/* Breadcrumbs */}
          <CustomBreadcrumbs
            chain={[
              { link: '/offices', children: 'Offices' },
              { link: '#', children: location.name || <Skeleton width={150} /> },
            ]}
          />

          {/* Page title */}
          <Typography variant="h3" color="primary.dark" marginTop={1}>
            {location.name}
          </Typography>
          {/* Address line */}
          <Typography marginBottom={1} fontWeight={400}>
            {location.address ? addressStringFromAddress(location.address) : 'no address'}
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
                <Schedule location={location} id={id} setLocation={setLocation}></Schedule>
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
                          {location.description}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </TabPanel>
            </Paper>
          </TabContext>
        </Box>
      </>
    </PageContainer>
  );
}
