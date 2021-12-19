const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('layout', { title: 'CS493 Portfolio Project' });
});

module.exports = router;