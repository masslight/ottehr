"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamReviewGroup = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var AssessmentTab_1 = require("../../AssessmentTab");
var ExamReviewItem_1 = require("./ExamReviewItem");
var ExamReviewGroup = function (props) {
    var label = props.label, items = props.items, extraItems = props.extraItems, _a = props.radio, radio = _a === void 0 ? false : _a;
    return (<material_1.Box sx={{ display: 'flex', gap: 2 }}>
      <AssessmentTab_1.AssessmentTitle>{label}</AssessmentTab_1.AssessmentTitle>
      {items.length === 0 && (!extraItems || extraItems.length === 0) ? (<material_1.Typography color="secondary.light">No data</material_1.Typography>) : (<material_1.Box sx={{ display: 'flex', columnGap: 4, rowGap: 0.5, flexWrap: 'wrap' }}>
          {items.map(function (details) { return (<ExamReviewItem_1.ExamReviewItem key={details.field} label={details.label} abnormal={details.abnormal} radio={radio} value={!!details.value}/>); })}
          {extraItems &&
                extraItems.length > 0 &&
                extraItems.map(function (details) { return (<ExamReviewItem_1.ExamReviewItem key={details.label} label={details.label} abnormal={details.abnormal}/>); })}
        </material_1.Box>)}
    </material_1.Box>);
};
exports.ExamReviewGroup = ExamReviewGroup;
//# sourceMappingURL=ExamReviewGroup.js.map