const crypto=require('crypto');

function validateEvidenceMetadata(input){
  const required=['storageRef','sha256','sourceName','authorizationBasis','receivedAt','classification'];
  const missing=required.filter(key=>!input[key]);
  if(missing.length) throw new Error(`Missing evidence metadata: ${missing.join(', ')}`);
  if(!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error('sha256 must be a 64-character hex digest');
  if(!['confidential','privileged','public','restricted'].includes(input.classification)) throw new Error('Invalid classification');
  return true;
}

function validateCitations(citations){
  if(!Array.isArray(citations)||citations.length===0) throw new Error('At least one evidence citation is required');
  for(const citation of citations){
    if(!citation.documentId||!citation.locator||String(citation.locator).length>200) throw new Error('Each citation requires documentId and a bounded locator');
  }
  return citations;
}

function assessReview(claims=[],requests=[]){
  const cited=claims.filter(claim=>Array.isArray(claim.citations)&&claim.citations.length>0).length;
  const openRequests=requests.filter(request=>!['satisfied','waived'].includes(request.status)).length;
  const groups=new Map();
  for(const claim of claims){const key=`${claim.entityKey}:${claim.claimKey}`;const values=groups.get(key)||new Set();values.add(JSON.stringify(claim.claimValue));groups.set(key,values);}
  const contradictions=[...groups.entries()].filter(([,values])=>values.size>1).map(([key])=>key);
  return {citationCoverage:claims.length?cited/claims.length:0,openRequests,contradictions,readyForSignoff:claims.length>0&&cited===claims.length&&openRequests===0&&contradictions.length===0};
}

function hashAuthorizedBytes(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
module.exports={validateEvidenceMetadata,validateCitations,assessReview,hashAuthorizedBytes};

