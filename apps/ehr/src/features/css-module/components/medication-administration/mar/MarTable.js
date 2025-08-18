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
exports.MarTable = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var components_1 = require("../../../../../telemed/components");
var useMedicationOperations_1 = require("../../../hooks/useMedicationOperations");
var CSSLoader_1 = require("../../CSSLoader");
var MarTableRow_1 = require("./MarTableRow");
var cellStyles = {
    padding: '8px',
    wordWrap: 'break-word',
    wordBreak: 'break-word',
    hyphens: 'auto',
    verticalAlign: 'top',
};
var HEADER_CELL_STYLES = {
    fontWeight: 'bold',
};
var sortByDateTimeCreated = function (items) {
    if (items === void 0) { items = []; }
    return items.sort(function (a, b) {
        var dateA = luxon_1.DateTime.fromISO(a.dateTimeCreated);
        var dateB = luxon_1.DateTime.fromISO(b.dateTimeCreated);
        if (!dateA.isValid && !dateB.isValid)
            return 0;
        if (!dateA.isValid)
            return 1;
        if (!dateB.isValid)
            return -1;
        return dateB.toMillis() - dateA.toMillis();
    });
};
var MarTable = function () {
    var _a, _b;
    var _c = (0, react_1.useState)(false), isPendingCollapsed = _c[0], setIsPendingCollapsed = _c[1];
    var _d = (0, react_1.useState)(false), isCompletedCollapsed = _d[0], setIsCompletedCollapsed = _d[1];
    var _e = (0, useMedicationOperations_1.useMedicationAPI)(), medications = _e.medications, isLoading = _e.isLoading;
    var pendingMedications = sortByDateTimeCreated(((_a = medications === null || medications === void 0 ? void 0 : medications.filter) === null || _a === void 0 ? void 0 : _a.call(medications, function (med) { return med.status === 'pending'; })) || []);
    var completedMedications = sortByDateTimeCreated(((_b = medications === null || medications === void 0 ? void 0 : medications.filter) === null || _b === void 0 ? void 0 : _b.call(medications, function (med) { return med.status !== 'pending'; })) || []);
    var handlePendingToggle = function () {
        setIsPendingCollapsed(function (prev) { return !prev; });
    };
    var handleCompletedToggle = function () {
        setIsCompletedCollapsed(function (prev) { return !prev; });
    };
    var columnStyles = {
        interactionsAlert: __assign({ width: '20px' }, cellStyles),
        medication: __assign({ width: '25%' }, cellStyles),
        dose: __assign({ width: '7%' }, cellStyles),
        route: __assign({ width: '10%' }, cellStyles),
        orderDateTime: __assign({ width: '12%' }, cellStyles),
        orderedBy: __assign({ width: '12%' }, cellStyles),
        instructions: __assign({ width: '15%' }, cellStyles),
        status: __assign(__assign({ width: 'auto', textWrap: 'nowrap' }, cellStyles), { paddingRight: '16px' }),
    };
    if (isLoading) {
        return <CSSLoader_1.CSSLoader height={'300px'}/>;
    }
    return (<material_1.TableContainer component={material_1.Paper}>
      <material_1.Table sx={{ minWidth: 650, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }} aria-label="medication table">
        <material_1.TableBody>
          <material_1.TableRow>
            <material_1.TableCell colSpan={6} sx={{ padding: 0 }}>
              <components_1.AccordionCard label={"Pending (".concat(pendingMedications.length, ")")} collapsed={isPendingCollapsed} onSwitch={handlePendingToggle} withBorder={false}>
                <material_1.Table>
                  <material_1.TableHead>
                    <material_1.TableRow>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.interactionsAlert), HEADER_CELL_STYLES)}></material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.medication), HEADER_CELL_STYLES)}>Medication</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.dose), HEADER_CELL_STYLES)}>Dose</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.route), HEADER_CELL_STYLES)}>Route</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.orderDateTime), HEADER_CELL_STYLES)}>
                        Order date/time
                      </material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.orderDateTime), HEADER_CELL_STYLES)}>Ordered by</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.instructions), HEADER_CELL_STYLES)}>Instructions</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.status), HEADER_CELL_STYLES)}>Status</material_1.TableCell>
                    </material_1.TableRow>
                  </material_1.TableHead>
                  <material_1.TableBody>
                    {pendingMedications.map(function (row) { return (<MarTableRow_1.MarTableRow key={row.id} medication={row} columnStyles={columnStyles}/>); })}
                  </material_1.TableBody>
                </material_1.Table>
              </components_1.AccordionCard>
            </material_1.TableCell>
          </material_1.TableRow>
          <material_1.TableRow>
            <material_1.TableCell colSpan={6} sx={{ padding: 0 }}>
              <components_1.AccordionCard label={"Completed (".concat(completedMedications.length, ")")} collapsed={isCompletedCollapsed} onSwitch={handleCompletedToggle} withBorder={false}>
                <material_1.Table>
                  <material_1.TableHead>
                    <material_1.TableRow>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.interactionsAlert), HEADER_CELL_STYLES)}></material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.medication), HEADER_CELL_STYLES)}>Medication</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.dose), HEADER_CELL_STYLES)}>Dose</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.route), HEADER_CELL_STYLES)}>Route</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.orderDateTime), HEADER_CELL_STYLES)}>
                        Order date/time
                      </material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.orderDateTime), HEADER_CELL_STYLES)}>Ordered by</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.orderDateTime), HEADER_CELL_STYLES)}>Given</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.orderDateTime), HEADER_CELL_STYLES)}>Given by</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.instructions), HEADER_CELL_STYLES)}>Instructions</material_1.TableCell>
                      <material_1.TableCell sx={__assign(__assign({}, columnStyles.status), HEADER_CELL_STYLES)}>Status</material_1.TableCell>
                    </material_1.TableRow>
                  </material_1.TableHead>
                  <material_1.TableBody>
                    {completedMedications.map(function (row) { return (<MarTableRow_1.MarTableRow key={row.id} medication={row} columnStyles={columnStyles}/>); })}
                  </material_1.TableBody>
                </material_1.Table>
              </components_1.AccordionCard>
            </material_1.TableCell>
          </material_1.TableRow>
        </material_1.TableBody>
      </material_1.Table>
    </material_1.TableContainer>);
};
exports.MarTable = MarTable;
//# sourceMappingURL=MarTable.js.map