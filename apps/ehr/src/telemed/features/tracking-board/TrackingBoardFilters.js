"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingBoardFilters = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var DateSearch_1 = require("../../../components/DateSearch");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var utils_2 = require("../../utils");
var LocationSelect_1 = require("./LocationSelect");
var StateSelect_1 = require("./StateSelect");
var VisitTypeSelect_1 = require("./VisitTypeSelect");
var selectOptions = [
    {
        label: 'Under 12 hours',
        value: utils_2.UnsignedFor.under12,
    },
    {
        label: 'More than 24 hours',
        value: utils_2.UnsignedFor.more24,
    },
    {
        label: 'All',
        value: utils_2.UnsignedFor.all,
    },
];
var TrackingBoardFilters = function (props) {
    var tab = props.tab;
    // const { oystehr: oystehrClient } = useApiClients();
    // const [practitioners, setPractitioners] = useState<Practitioner[] | undefined>(undefined);
    // const [healthcareServices, setHealthcareServices] = useState<HealthcareService[] | undefined>(undefined);
    // const [providers, setProviders] = useState<string[] | undefined>(undefined);
    // const [groups, setGroups] = useState<string[] | undefined>(undefined);
    // useEffect(() => {
    //   async function getPractitioners(oystehrClient: Oystehr): Promise<void> {
    //     if (!oystehrClient) {
    //       return;
    //     }
    //     try {
    //       const practitionersTemp: Practitioner[] = (
    //         await oystehrClient.fhir.search<Practitioner>({
    //           resourceType: 'Practitioner',
    //           params: [
    //             { name: '_count', value: '1000' },
    //             // { name: 'name:missing', value: 'false' },
    //           ],
    //         })
    //       ).unbundle();
    //       setPractitioners(practitionersTemp);
    //     } catch (e) {
    //       console.error('error loading practitioners', e);
    //     }
    //   }
    //   async function getHealthcareServices(oystehrClient: Oystehr): Promise<void> {
    //     if (!oystehrClient) {
    //       return;
    //     }
    //     try {
    //       const healthcareServicesTemp: HealthcareService[] = (
    //         await oystehrClient.fhir.search<HealthcareService>({
    //           resourceType: 'HealthcareService',
    //           params: [{ name: '_count', value: '1000' }],
    //         })
    //       ).unbundle();
    //       setHealthcareServices(healthcareServicesTemp);
    //     } catch (e) {
    //       console.error('error loading healthcare services', e);
    //     }
    //   }
    //   if (oystehrClient) {
    //     void getPractitioners(oystehrClient);
    //     void getHealthcareServices(oystehrClient);
    //   }
    // }, [oystehrClient]);
    var _a = (0, getSelectors_1.getSelectors)(state_1.useTrackingBoardStore, [
        'date',
        'unsignedFor',
        'showOnlyNext',
    ]), date = _a.date, unsignedFor = _a.unsignedFor, showOnlyNext = _a.showOnlyNext;
    // const handleProviderChange = (_e: any, value: string[]): void => {
    //   console.log(10, value);
    //   setProviders(value);
    //   useTrackingBoardStore.setState({ providers: value });
    // };
    // const handleGroupChange = (_e: any, value: string[]): void => {
    //   console.log(10, value);
    //   setGroups(value);
    //   useTrackingBoardStore.setState({ groups: value });
    // };
    var useUnsigned = tab === utils_1.ApptTelemedTab['not-signed'];
    var useFirst = tab === utils_1.ApptTelemedTab.ready;
    return (<material_1.Box sx={{ padding: 2, display: 'flex', flexDirection: 'column' }}>
      <material_1.Grid container spacing={2}>
        <material_1.Grid item xs={6}>
          <LocationSelect_1.LocationsSelect />
        </material_1.Grid>
        <material_1.Grid item xs={6}>
          <StateSelect_1.StateSelect />
        </material_1.Grid>
        {/* <Grid item xs={6}>
          <ProvidersSelect
            providers={providers ? providers : []}
            practitioners={practitioners}
            handleSubmit={handleProviderChange}
          ></ProvidersSelect>
        </Grid> */}
        {/* <Grid item xs={6}>
          <GroupSelect
            groups={groups ? groups : []}
            healthcareServices={healthcareServices}
            handleSubmit={handleGroupChange}
          ></GroupSelect>
        </Grid> */}
        <material_1.Grid item xs={6}>
          <DateSearch_1.default label="Date" date={date} setDate={function (date) { return state_1.useTrackingBoardStore.setState({ date: date }); }} updateURL={false} storeDateInLocalStorage={false} defaultValue={luxon_1.DateTime.now()}/>
        </material_1.Grid>
        <material_1.Grid item xs={6}>
          <VisitTypeSelect_1.VisitTypeSelect />
        </material_1.Grid>
        {useUnsigned && (<material_1.Grid item xs={6}>
            <material_1.FormControl fullWidth>
              <material_1.InputLabel>Unsigned for</material_1.InputLabel>
              <material_1.Select value={unsignedFor} label="Unsigned for" onChange={function (event) { return state_1.useTrackingBoardStore.setState({ unsignedFor: event.target.value }); }}>
                {selectOptions.map(function (option) { return (<material_1.MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </material_1.MenuItem>); })}
              </material_1.Select>
            </material_1.FormControl>
          </material_1.Grid>)}
      </material_1.Grid>
      {useFirst && (<material_1.FormControlLabel sx={{ pt: 2 }} control={<material_1.Checkbox checked={showOnlyNext} onChange={function (e) { return state_1.useTrackingBoardStore.setState({ showOnlyNext: e.target.checked }); }}/>} label="Show only NEXT"/>)}
    </material_1.Box>);
};
exports.TrackingBoardFilters = TrackingBoardFilters;
//# sourceMappingURL=TrackingBoardFilters.js.map