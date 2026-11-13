'use strict';
const { BUILTIN } = require('./model-registry');
const { resolveModel, applyModel } = require('./model-routing');
// All creation paths use the same snapshot and final payload validation.
function validatePayload(payload, registry=BUILTIN) {
  const model=resolveModel(payload.model,registry);
  const result=applyModel(payload,model);
  Object.assign(payload,result);
  return payload;
}
module.exports={validatePayload};
