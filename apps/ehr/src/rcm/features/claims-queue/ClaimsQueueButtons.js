"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimsQueueButtons = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_query_1 = require("react-query");
var RoundedButton_1 = require("../../../components/RoundedButton");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var components_1 = require("../claim/modals/components");
var ClaimsQueueButtons = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimsQueueStore, ['selectedRows', 'employees', 'items']), selectedRows = _a.selectedRows, employees = _a.employees, items = _a.items;
    var _b = (0, react_1.useState)(), currentTeamMember = _b[0], setCurrentTeamMember = _b[1];
    var editClaim = (0, state_1.useEditClaimInformationMutation)();
    var queryClient = (0, react_query_1.useQueryClient)();
    // const [anchorExportEl, setAnchorExportEl] = useState<null | HTMLElement>(null);
    // const exportOpen = Boolean(anchorExportEl);
    var _c = (0, react_1.useState)(false), openAssign = _c[0], setOpenAssign = _c[1];
    // const handleClickExport = (event: MouseEvent<HTMLButtonElement>): void => {
    //   setAnchorExportEl(event.currentTarget);
    // };
    // const handleCloseExport = (): void => {
    //   setAnchorExportEl(null);
    // };
    var handleClickOpenAssign = function () {
        setCurrentTeamMember(undefined);
        setOpenAssign(true);
    };
    var handleCloseAssign = function () {
        setOpenAssign(false);
    };
    var currentTeamMemberObject = (0, react_1.useMemo)(function () { return employees.find(function (employee) { return employee.id === currentTeamMember; }); }, [employees, currentTeamMember]);
    var handleAssign = function () {
        if (!currentTeamMemberObject) {
            return;
        }
        var claims = selectedRows
            .map(function (row) { var _a; return (_a = items.find(function (item) { return item.claim.id === row; })) === null || _a === void 0 ? void 0 : _a.claim; })
            .filter(function (c) { return c; });
        var promises = claims.map(function (claim) {
            return editClaim.mutateAsync({
                claimData: __assign(__assign({}, claim), { enterer: { reference: currentTeamMemberObject.profile } }),
                previousClaimData: claim,
                fieldsToUpdate: ['enterer'],
            });
        });
        void Promise.all(promises).then(function () {
            void queryClient.invalidateQueries({ queryKey: ['rcm-claims-queue'] });
            handleCloseAssign();
        });
    };
    return (<material_1.Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      <RoundedButton_1.RoundedButton disabled={selectedRows.length === 0} variant="contained" onClick={handleClickOpenAssign}>
        Assign to a team member
      </RoundedButton_1.RoundedButton>

      {/*<RoundedButton disabled={selectedRows.length === 0} startIcon={<OpenInNewIcon />} onClick={handleClickExport}>*/}
      {/*  Export*/}
      {/*</RoundedButton>*/}

      {/*<Menu*/}
      {/*  open={exportOpen}*/}
      {/*  anchorEl={anchorExportEl}*/}
      {/*  onClose={handleCloseExport}*/}
      {/*  MenuListProps={{*/}
      {/*    'aria-labelledby': 'basic-button',*/}
      {/*  }}*/}
      {/*>*/}
      {/*  <MenuItem onClick={handleCloseExport}>Export to CSV</MenuItem>*/}
      {/*  <MenuItem onClick={handleCloseExport}>Export to XLS</MenuItem>*/}
      {/*</Menu>*/}

      <material_1.Dialog open={openAssign} onClose={handleCloseAssign} maxWidth="xs" fullWidth>
        <material_1.DialogTitle component={material_1.Typography} variant="h5" color="primary.dark" sx={{ pb: 2 }}>
          Select team member
        </material_1.DialogTitle>

        <material_1.Box sx={{ px: 3 }}>
          <components_1.VirtualizedAutocomplete value={currentTeamMemberObject} onChange={function (employee) { return setCurrentTeamMember(employee === null || employee === void 0 ? void 0 : employee.id); }} options={employees} label="Team member" renderRow={function (employee) {
            if (employee.firstName && employee.lastName)
                return [employee.lastName, employee.firstName].join(', ');
            else if (employee.name)
                return employee.name;
            else
                return '-';
        }}/>
        </material_1.Box>

        <material_1.DialogActions sx={{ display: 'flex', justifyContent: 'start', gap: 2, p: 3, pt: 2 }}>
          <lab_1.LoadingButton sx={{
            fontWeight: 500,
            borderRadius: '100px',
            mr: '8px',
            textTransform: 'none',
        }} loading={editClaim.isLoading} onClick={handleAssign} disabled={!currentTeamMember} variant="contained" color="primary">
            Assign member
          </lab_1.LoadingButton>
          <RoundedButton_1.RoundedButton onClick={handleCloseAssign} color="primary">
            Cancel
          </RoundedButton_1.RoundedButton>
        </material_1.DialogActions>
      </material_1.Dialog>
    </material_1.Box>);
};
exports.ClaimsQueueButtons = ClaimsQueueButtons;
//# sourceMappingURL=ClaimsQueueButtons.js.map