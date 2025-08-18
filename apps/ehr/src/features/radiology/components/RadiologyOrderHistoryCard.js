"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiologyOrderHistoryCard = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var AccordionCard_1 = require("../../../telemed/components/AccordionCard");
var RadiologyOrderHistoryCard = function (_a) {
    var _b = _a.isCollapsed, isCollapsed = _b === void 0 ? false : _b, _c = _a.orderHistory, orderHistory = _c === void 0 ? [] : _c, timezone = _a.timezone;
    var _d = (0, react_1.useState)(isCollapsed), collapsed = _d[0], setCollapsed = _d[1];
    var formatDate = function (datetime) {
        if (!datetime || !luxon_1.DateTime.fromISO(datetime).isValid)
            return '';
        return luxon_1.DateTime.fromISO(datetime).setZone(timezone).toFormat('MM/dd/yyyy hh:mm a');
    };
    return (<>
      <AccordionCard_1.AccordionCard label={'Procedure History'} collapsed={collapsed} withBorder={false} onSwitch={function () {
            setCollapsed(function (prevState) { return !prevState; });
        }}>
        <material_1.Table>
          {orderHistory.map(function (row) {
            return (<material_1.TableRow key={"".concat(row.status, "-").concat(row.performer, "-").concat(row.date)}>
                <material_1.TableCell>{row.status.toUpperCase()}</material_1.TableCell>
                <material_1.TableCell>{row.performer}</material_1.TableCell>
                <material_1.TableCell>{formatDate(row.date)}</material_1.TableCell>
              </material_1.TableRow>);
        })}
        </material_1.Table>
      </AccordionCard_1.AccordionCard>
    </>);
};
exports.RadiologyOrderHistoryCard = RadiologyOrderHistoryCard;
//# sourceMappingURL=RadiologyOrderHistoryCard.js.map