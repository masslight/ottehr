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
exports.MarTableRow = void 0;
var material_1 = require("@mui/material");
var TouchRipple_1 = require("@mui/material/ButtonBase/TouchRipple");
var styles_1 = require("@mui/material/styles");
var useTouchRipple_1 = require("@mui/material/useTouchRipple");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var helpers_1 = require("../../../routing/helpers");
var MedicationStatusChip_1 = require("../statuses/MedicationStatusChip");
var MedicationActions_1 = require("./MedicationActions");
var MedicationBarcodeScan_1 = require("./MedicationBarcodeScan");
var MedicationInteractionsAlertButton_1 = require("./MedicationInteractionsAlertButton");
var DATE_FORMAT = 'MM/dd/yyyy hh:mm a';
var StyledTouchRipple = (0, styles_1.styled)(TouchRipple_1.default)(function (_a) {
    var theme = _a.theme;
    return ({
        '& .MuiTouchRipple-child': {
            backgroundColor: (0, styles_1.alpha)(theme.palette.primary.main, 0.42),
        },
    });
});
var MarTableRow = function (_a) {
    var _b;
    var medication = _a.medication, columnStyles = _a.columnStyles;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var rippleRef = react_1.default.useRef(null);
    var theme = (0, styles_1.useTheme)();
    var getRippleHandlers = (0, useTouchRipple_1.default)({
        disabled: false,
        focusVisible: false,
        rippleRef: rippleRef,
    }).getRippleHandlers;
    var isPending = medication.status === 'pending';
    var handleRowClick = function () {
        if (!isPending) {
            return;
        }
        requestAnimationFrame(function () {
            navigate("".concat((0, helpers_1.getInHouseMedicationDetailsUrl)(appointmentId), "?scrollTo=").concat(medication.id));
        });
    };
    var formatOrderDateTime = (0, react_1.useMemo)(function () {
        if (!medication.dateTimeCreated)
            return '-';
        var dt = luxon_1.DateTime.fromISO(medication.dateTimeCreated);
        if (!dt.isValid)
            return '-';
        return dt.toFormat(DATE_FORMAT);
    }, [medication.dateTimeCreated]);
    var formatGivenDateTime = (0, react_1.useMemo)(function () {
        // Try new format first: effectiveDateTime (ISO format)
        if (medication.effectiveDateTime) {
            var date = luxon_1.DateTime.fromISO(medication.effectiveDateTime);
            if (date.isValid)
                return date.toFormat(DATE_FORMAT);
        }
        // Fallback to deprecated format: dateGiven + timeGiven for backward compatibility
        if (medication.dateGiven && medication.timeGiven) {
            var date = luxon_1.DateTime.fromFormat("".concat(medication.dateGiven, " ").concat(medication.timeGiven), 'yyyy-MM-dd HH:mm:ss');
            if (date.isValid)
                return date.toFormat(DATE_FORMAT);
        }
        return '-';
    }, [medication.effectiveDateTime, medication.dateGiven, medication.timeGiven]);
    return (<material_1.TableRow data-testid={data_test_ids_1.dataTestIds.inHouseMedicationsPage.marTableRow} sx={__assign({ cursor: 'pointer', position: 'relative', paddingLeft: '12px' }, (isPending
            ? {
                '&:hover': {
                    backgroundColor: (0, styles_1.alpha)(theme.palette.primary.main, 0.04),
                },
                willChange: 'background-color',
            }
            : { cursor: 'default' }))} onClick={handleRowClick} {...getRippleHandlers()}>
      <material_1.TableCell sx={columnStyles.interactionsAlert}>
        <MedicationInteractionsAlertButton_1.MedicationInteractionsAlertButton medication={medication}/>
      </material_1.TableCell>
      <material_1.TableCell data-testid={data_test_ids_1.dataTestIds.inHouseMedicationsPage.marTableMedicationCell} sx={columnStyles.medication}>
        <MedicationBarcodeScan_1.MedicationBarcodeScan medication={medication}/>
      </material_1.TableCell>
      <material_1.TableCell data-testid={data_test_ids_1.dataTestIds.inHouseMedicationsPage.marTableDoseCell} sx={columnStyles.dose}>
        {medication.dose} {medication.units}
      </material_1.TableCell>
      <material_1.TableCell data-testid={data_test_ids_1.dataTestIds.inHouseMedicationsPage.marTableRouteCell} sx={columnStyles.route}>
        {((_b = (0, utils_1.searchRouteByCode)(medication.route)) === null || _b === void 0 ? void 0 : _b.display) || '-'}
      </material_1.TableCell>
      <material_1.TableCell sx={columnStyles.orderDateTime}>{formatOrderDateTime}</material_1.TableCell>
      <material_1.TableCell sx={columnStyles.orderDateTime}>{medication.orderedByProvider}</material_1.TableCell>
      {!isPending && (<>
          <material_1.TableCell sx={columnStyles.orderDateTime}>{formatGivenDateTime}</material_1.TableCell>
          <material_1.TableCell sx={columnStyles.orderDateTime}>{medication.administeredProvider || ''}</material_1.TableCell>
        </>)}
      <material_1.TableCell data-testid={data_test_ids_1.dataTestIds.inHouseMedicationsPage.marTableInstructionsCell} sx={columnStyles.instructions}>
        {medication.instructions}
      </material_1.TableCell>
      <material_1.TableCell data-testid={data_test_ids_1.dataTestIds.inHouseMedicationsPage.marTableStatusCell} sx={columnStyles.status}>
        <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <MedicationStatusChip_1.MedicationStatusChip medication={medication}/>
          <MedicationActions_1.MedicationActions medication={medication}/>
        </material_1.Box>
      </material_1.TableCell>
      <StyledTouchRipple ref={rippleRef} center={false}/>
    </material_1.TableRow>);
};
exports.MarTableRow = MarTableRow;
//# sourceMappingURL=MarTableRow.js.map