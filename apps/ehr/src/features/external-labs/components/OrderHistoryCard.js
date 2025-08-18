"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderHistoryCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var AccordionCard_1 = require("../../../telemed/components/AccordionCard");
var ExternalLabsStatusChip_1 = require("./ExternalLabsStatusChip");
var OrderHistoryCard = function (_a) {
    var _b = _a.isCollapsed, isCollapsed = _b === void 0 ? false : _b, _c = _a.orderHistory, orderHistory = _c === void 0 ? [] : _c, timezone = _a.timezone, isPSCPerformed = _a.isPSCPerformed;
    var _d = (0, react_1.useState)(isCollapsed), collapsed = _d[0], setCollapsed = _d[1];
    return (<>
      <AccordionCard_1.AccordionCard label={'Order History'} collapsed={collapsed} withBorder={false} onSwitch={function () {
            setCollapsed(function (prevState) { return !prevState; });
        }}>
        <material_1.Table>
          {orderHistory.map(function (row) {
            var isReviewOrReceiveAction = row.action === 'reviewed' || row.action === 'received' || row.action === 'corrected';
            return (<material_1.TableRow key={"".concat(row.action, "-").concat(row.performer, "-").concat(row.date)}>
                <material_1.TableCell>
                  {<ExternalLabsStatusChip_1.LabsOrderStatusChip status={row.action}/>}
                  {isReviewOrReceiveAction ? " (".concat(row.testType, ")") : ''}
                </material_1.TableCell>
                <material_1.TableCell>
                  {row.action === 'performed' && isPSCPerformed
                    ? utils_1.PSC_HOLD_LOCALE
                    : row.performer
                        ? "by ".concat(row.performer)
                        : ''}
                </material_1.TableCell>
                <material_1.TableCell>{(0, utils_1.formatDateForLabs)(row.date, timezone)}</material_1.TableCell>
              </material_1.TableRow>);
        })}
        </material_1.Table>
      </AccordionCard_1.AccordionCard>
    </>);
};
exports.OrderHistoryCard = OrderHistoryCard;
//# sourceMappingURL=OrderHistoryCard.js.map