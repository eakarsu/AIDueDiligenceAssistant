// Three-strategy AI JSON parser:
// 1. Direct JSON.parse on full response
// 2. Extract from ```json ... ``` fenced code block
// 3. Extract first JSON object via regex { ... } / [ ... ]
function parseAIJson(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') return raw;
  const text = String(raw).trim();

  try {
    return JSON.parse(text);
  } catch (_) {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (_) {}
  }

  const objectMatch = text.match(/[\{\[][\s\S]*[\}\]]/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]); } catch (_) {}
  }

  return null;
}

module.exports = { parseAIJson };
