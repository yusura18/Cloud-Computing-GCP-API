const express = require('express');
const secured = require('../lib/middleware/secured');
const router = express.Router();

/* 
  GET user profile. extraParams contains JWT and is
  stored by passport strategy.
*/
router.get('/', secured(), function (req, res, next) {
  const { _raw, _json, ...userProfile } = req.user;
  // console.log(req.user);
  res.render('userinfo', {
    userInfo: JSON.stringify(userProfile, null, 2), 
    title: 'User Info Page'
  });
});

module.exports = router;