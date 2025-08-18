"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsSearchTable = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var data_test_ids_1 = require("../../constants/data-test-ids");
var constants_1 = require("./constants");
var StyledTabs = (0, material_1.styled)(material_1.Tabs)(function (_a) {
    var theme = _a.theme;
    return ({
        color: theme.palette.background.paper,
        padding: 0,
        '& .MuiTabs-indicator': {
            display: 'none',
        },
        '& .MuiTab-root': {
            borderRadius: 0,
            minHeight: 40,
            textTransform: 'none',
            fontWeight: 400,
            padding: '6px 16px',
        },
        '& .Mui-selected': {
            backgroundColor: "".concat(theme.palette.primary.main, " !important"),
            color: "".concat(theme.palette.background.paper, " !important"),
        },
    });
});
var PatientsSearchTable = function (_a) {
    var searchResult = _a.searchResult, arePatientsLoading = _a.arePatientsLoading, searchOptions = _a.searchOptions, search = _a.search;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _b = (0, react_1.useState)('allPatients'), activeTab = _b[0], setActiveTab = _b[1];
    var page = Math.floor(searchOptions.pagination.offset / searchOptions.pagination.pageSize);
    var sort = function (field) { return function () {
        var order = searchOptions.sort.field === field && searchOptions.sort.order === 'asc' ? 'desc' : 'asc';
        void search({ sort: { field: field, order: order }, pagination: { offset: 0 } });
    }; };
    if (!(searchResult === null || searchResult === void 0 ? void 0 : searchResult.patients.length) && !arePatientsLoading) {
        return (<material_1.Box sx={{ textAlign: 'center', p: 3 }}>
        <material_1.Typography variant="body1">Set up search filter and press Search to find patients</material_1.Typography>
      </material_1.Box>);
    }
    return (<>
      <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2 }}>
        <StyledTabs value={activeTab} onChange={function (_, newValue) { return setActiveTab(newValue); }}>
          <material_1.Tab value="allPatients" label="All Patients"/>
        </StyledTabs>
      </material_1.Box>

      <material_1.TableContainer component={material_1.Paper} sx={{
            '& .MuiTableCell-root': {
                overflowWrap: 'anywhere',
            },
        }}>
        <material_1.Table>
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell width={constants_1.COLUMN_CONFIG.pid.width}>PID</material_1.TableCell>
              <material_1.TableCell width={constants_1.COLUMN_CONFIG.name.width}>
                <material_1.TableSortLabel active={searchOptions.sort.field === 'name'} direction={searchOptions.sort.field === 'name' ? searchOptions.sort.order : 'asc'} onClick={sort('name')} hideSortIcon={false} sx={{
            '& .MuiTableSortLabel-icon': {
                opacity: searchOptions.sort.field === 'name' ? 1 : 0.55,
                color: searchOptions.sort.field === 'name' ? 'inherit' : 'grey.500',
            },
        }}>
                  Name
                </material_1.TableSortLabel>
              </material_1.TableCell>
              <material_1.TableCell width={constants_1.COLUMN_CONFIG.dob.width}>
                <material_1.TableSortLabel active={searchOptions.sort.field === 'dob'} direction={searchOptions.sort.field === 'dob' ? searchOptions.sort.order : 'asc'} onClick={sort('dob')} hideSortIcon={false} sx={{
            '& .MuiTableSortLabel-icon': {
                opacity: searchOptions.sort.field === 'dob' ? 1 : 0.55,
                color: searchOptions.sort.field === 'dob' ? 'inherit' : 'grey.500',
            },
        }}>
                  DOB
                </material_1.TableSortLabel>
              </material_1.TableCell>
              <material_1.TableCell width={constants_1.COLUMN_CONFIG.email.width}>Email</material_1.TableCell>
              <material_1.TableCell width={constants_1.COLUMN_CONFIG.phone.width}>Phone</material_1.TableCell>
              <material_1.TableCell width={constants_1.COLUMN_CONFIG.address.width}>Address</material_1.TableCell>
              <material_1.TableCell width={constants_1.COLUMN_CONFIG.lastVisit.width}>Last Visit</material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {arePatientsLoading
            ? Array.from(new Array((searchResult === null || searchResult === void 0 ? void 0 : searchResult.patients.length) || searchOptions.pagination.pageSize)).map(function (_, index) { return (<material_1.TableRow key={"skeleton-".concat(index)}>
                      <material_1.TableCell width={constants_1.COLUMN_CONFIG.pid.width}>
                        <material_1.Skeleton animation="wave" width={'100%'}/>
                      </material_1.TableCell>
                      <material_1.TableCell width={constants_1.COLUMN_CONFIG.name.width}>
                        <material_1.Skeleton animation="wave" width={'100%'}/>
                      </material_1.TableCell>
                      <material_1.TableCell width={constants_1.COLUMN_CONFIG.dob.width}>
                        <material_1.Skeleton animation="wave" width={'100%'}/>
                      </material_1.TableCell>
                      <material_1.TableCell width={constants_1.COLUMN_CONFIG.email.width}>
                        <material_1.Skeleton animation="wave" width={'100%'}/>
                      </material_1.TableCell>
                      <material_1.TableCell width={constants_1.COLUMN_CONFIG.phone.width}>
                        <material_1.Skeleton animation="wave" width={'100%'}/>
                      </material_1.TableCell>
                      <material_1.TableCell width={constants_1.COLUMN_CONFIG.address.width}>
                        <material_1.Skeleton animation="wave" width={'100%'}/>
                      </material_1.TableCell>
                      <material_1.TableCell width={constants_1.COLUMN_CONFIG.lastVisit.width}>
                        <material_1.Skeleton animation="wave" width={'100%'}/>
                      </material_1.TableCell>
                    </material_1.TableRow>); })
            : searchResult === null || searchResult === void 0 ? void 0 : searchResult.patients.map(function (patient) {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                return (<material_1.TableRow key={patient.id} data-testid={data_test_ids_1.dataTestIds.patients.searchResultRow(patient.id)} onClick={function () {
                        navigate("/patient/".concat(patient.id));
                    }} sx={{ cursor: 'pointer' }}>
                    <material_1.TableCell data-testid={data_test_ids_1.dataTestIds.patients.patientId} width={constants_1.COLUMN_CONFIG.pid.width}>
                      {patient.id}
                    </material_1.TableCell>
                    <material_1.TableCell width={constants_1.COLUMN_CONFIG.name.width} data-testid={data_test_ids_1.dataTestIds.patients.patientName}>
                      {patient.name}
                    </material_1.TableCell>
                    <material_1.TableCell width={constants_1.COLUMN_CONFIG.dob.width} data-testid={data_test_ids_1.dataTestIds.patients.patientDateOfBirth}>
                      {patient.birthDate ? luxon_1.DateTime.fromISO(patient.birthDate).toFormat('MM/dd/yyyy') : ''}
                    </material_1.TableCell>
                    <material_1.TableCell width={constants_1.COLUMN_CONFIG.email.width} data-testid={data_test_ids_1.dataTestIds.patients.patientEmail}>
                      {patient.email}
                    </material_1.TableCell>
                    <material_1.TableCell width={constants_1.COLUMN_CONFIG.phone.width} data-testid={data_test_ids_1.dataTestIds.patients.patientPhoneNumber}>
                      {patient.phone}
                    </material_1.TableCell>
                    <material_1.TableCell width={constants_1.COLUMN_CONFIG.address.width} data-testid={data_test_ids_1.dataTestIds.patients.patientAddress}>
                      {patient.address ? (<>
                          {(_a = patient === null || patient === void 0 ? void 0 : patient.address) === null || _a === void 0 ? void 0 : _a.line}
                          {((_b = patient === null || patient === void 0 ? void 0 : patient.address) === null || _b === void 0 ? void 0 : _b.line) && ((_c = patient === null || patient === void 0 ? void 0 : patient.address) === null || _c === void 0 ? void 0 : _c.city) && ", "}
                          {(_d = patient === null || patient === void 0 ? void 0 : patient.address) === null || _d === void 0 ? void 0 : _d.city}
                          {((_e = patient === null || patient === void 0 ? void 0 : patient.address) === null || _e === void 0 ? void 0 : _e.city) && ((_f = patient === null || patient === void 0 ? void 0 : patient.address) === null || _f === void 0 ? void 0 : _f.state) && <br />}
                          {(_g = patient === null || patient === void 0 ? void 0 : patient.address) === null || _g === void 0 ? void 0 : _g.state}
                          {((_h = patient === null || patient === void 0 ? void 0 : patient.address) === null || _h === void 0 ? void 0 : _h.state) && ((_j = patient === null || patient === void 0 ? void 0 : patient.address) === null || _j === void 0 ? void 0 : _j.zip) && ' '}
                          {(_k = patient === null || patient === void 0 ? void 0 : patient.address) === null || _k === void 0 ? void 0 : _k.zip}
                        </>) : ('-')}
                    </material_1.TableCell>
                    <material_1.TableCell width={constants_1.COLUMN_CONFIG.lastVisit.width}>
                      {patient.lastVisit
                        ? "".concat(new Date(patient.lastVisit.date).toLocaleDateString(), " at ").concat(patient.lastVisit.location)
                        : '-'}
                    </material_1.TableCell>
                  </material_1.TableRow>);
            })}
          </material_1.TableBody>
          <material_1.TableFooter>
            <material_1.TableRow>
              <material_1.TablePagination rowsPerPageOptions={constants_1.SEARCH_CONFIG.ROWS_PER_PAGE_OPTIONS.map(function (option) { return ({
            value: option,
            label: option.toString(),
        }); })} colSpan={7} count={(searchResult === null || searchResult === void 0 ? void 0 : searchResult.pagination.totalItems) || 0} rowsPerPage={searchOptions.pagination.pageSize} page={page} onPageChange={function (_, newPage) {
            void search({ pagination: { offset: searchOptions.pagination.pageSize * newPage } });
        }} onRowsPerPageChange={function (event) {
            var newItemsPerPage = parseInt(event.target.value, 10);
            void search({ pagination: { pageSize: newItemsPerPage, offset: 0 } });
        }} slotProps={{
            actions: {
                nextButton: {
                    disabled: !(searchResult === null || searchResult === void 0 ? void 0 : searchResult.pagination.next) || arePatientsLoading,
                },
                previousButton: {
                    disabled: !(searchResult === null || searchResult === void 0 ? void 0 : searchResult.pagination.prev) || arePatientsLoading,
                },
            },
        }} data-testid={data_test_ids_1.dataTestIds.pagination.paginationContainer}/>
            </material_1.TableRow>
          </material_1.TableFooter>
        </material_1.Table>
      </material_1.TableContainer>
    </>);
};
exports.PatientsSearchTable = PatientsSearchTable;
//# sourceMappingURL=PatientsSearchTable.js.map