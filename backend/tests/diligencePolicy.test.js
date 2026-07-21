const assert=require('node:assert/strict');const test=require('node:test');
const {validateEvidenceMetadata,validateCitations,assessReview,hashAuthorizedBytes}=require('../services/diligencePolicy');
test('evidence requires authorization and provenance',()=>{assert.throws(()=>validateEvidenceMetadata({storageRef:'x'}),/Missing evidence/);assert.doesNotThrow(()=>validateEvidenceMetadata({storageRef:'vault/1',sha256:'a'.repeat(64),sourceName:'Data room',authorizationBasis:'Seller authorized room',receivedAt:'2026-07-18',classification:'confidential'}));});
test('uncited claims cannot enter the review record',()=>assert.throws(()=>validateCitations([]),/citation/));
test('readiness exposes contradictions and open requests',()=>{const result=assessReview([{entityKey:'acme',claimKey:'revenue',claimValue:10,citations:[{}]},{entityKey:'acme',claimKey:'revenue',claimValue:12,citations:[{}]}],[{status:'open'}]);assert.deepEqual(result.contradictions,['acme:revenue']);assert.equal(result.readyForSignoff,false);});
test('authorized document bytes have a stable provenance hash',()=>assert.equal(hashAuthorizedBytes(Buffer.from('record')),hashAuthorizedBytes(Buffer.from('record'))));

