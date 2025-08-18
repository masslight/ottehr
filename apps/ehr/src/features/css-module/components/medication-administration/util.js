"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionsSummary = interactionsSummary;
function interactionsSummary(interactions) {
    var names = [];
    interactions.drugInteractions
        .flatMap(function (drugInteraction) { return drugInteraction.drugs.map(function (drug) { return drug.name; }); })
        .forEach(function (name) { return names.push(name); });
    if (interactions.allergyInteractions.length > 0) {
        names.push('Allergy');
    }
    return names.join(', ');
}
//# sourceMappingURL=util.js.map