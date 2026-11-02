import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceStatusesFromDashboard, uniformCanonicalStatus, canonicalFailureOrUnknown} from '../src/lib/canonicalSourceStatus.ts';
const names=['moves','people','flows','content','money'];
test('source failures remain distinct per canonical source and do not expose provider details',()=>{
 for(const failed of names){
  const states=sourceStatusesFromDashboard({sourceErrors:{[failed]:'private provider details'}},false);
  assert.equal(states[failed],'failed');
  for(const other of names.filter(x=>x!==failed)) assert.equal(states[other],'reported-success');
  assert.ok(canonicalFailureOrUnknown(states));
  assert.doesNotMatch(JSON.stringify(states),/private/);
 }
});
test('missing, malformed, or fallback source metadata is unknown, not successful or empty',()=>{
 for(const [payload,fallback] of [[{},false],[{sourceErrors:[]},false],[{sourceErrors:{}},true]]){
  const states=sourceStatusesFromDashboard(payload,fallback); assert.deepEqual(states,uniformCanonicalStatus('unknown'));
  assert.equal(canonicalFailureOrUnknown(states),true);
 }
 assert.equal(canonicalFailureOrUnknown(sourceStatusesFromDashboard({sourceErrors:{}},false)),false);
});
