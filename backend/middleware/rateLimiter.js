const rateLimit = require('express-rate-limit');
let ipKeyGenerator;
try {
  // express-rate-limit v7+ exposes ipKeyGenerator helper for IPv6-safe keying
  ({ ipKeyGenerator } = require('express-rate-limit'));
} catch (_e) {
  ipKeyGenerator = (req) => req.ip;
}

const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req, res) => req.user ? `user:${req.user.id}` : ipKeyGenerator(req, res),
  message: { error: 'AI rate limit exceeded. Max 20 requests/hour.' }
});

module.exports = { aiRateLimiter };
