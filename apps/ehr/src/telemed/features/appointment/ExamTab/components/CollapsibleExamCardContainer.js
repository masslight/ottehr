"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollapsibleExamCardContainer = void 0;
var useExamCardCollapsed_1 = require("../../../../hooks/useExamCardCollapsed");
var ExamCardContainer_1 = require("./ExamCardContainer");
var CollapsibleExamCardContainer = function (props) {
    var cardName = props.cardName, innerProps = __rest(props, ["cardName"]);
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)(cardName), isCollapsed = _a[0], onSwitch = _a[1];
    return <ExamCardContainer_1.ExamCardContainer collapsed={isCollapsed} onSwitch={onSwitch} {...innerProps}/>;
};
exports.CollapsibleExamCardContainer = CollapsibleExamCardContainer;
//# sourceMappingURL=CollapsibleExamCardContainer.js.map