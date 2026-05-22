const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({
  summary: { executives_mapped: 18, dependency_risks: 5, retention_flags: 4, open_questions: 11 },
  people: [
    { name: 'CTO', dependency: 'core IP knowledge', risk: 'high', action: 'retention package and knowledge transfer' },
    { name: 'VP Sales', dependency: 'top enterprise accounts', risk: 'medium', action: 'customer relationship audit' },
    { name: 'Head of Regulatory', dependency: 'pending approvals', risk: 'medium', action: 'backup owner identified' },
  ],
}));

module.exports = router;
