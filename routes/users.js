const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const dotenv = require('dotenv');
const request = require('request');
const axios = require('axios');

dotenv.config();

router.use(bodyParser.json());


router.get('/users', function(req, res) {
    var appUsers = [];
    // Get Management API access token
    axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {client_id: `${process.env.MANAGE_AUTH0_CLIENT_ID}`, client_secret: `${process.env.MANAGE_AUTH0_CLIENT_SECRET}`, audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`, grant_type: "client_credentials"},
    { headers: {'content-type': 'application/json'}}).then(response => {
        // console.log(response.data);
        axios.get(`https://${process.env.AUTH0_DOMAIN}/api/v2/users`, {headers: {'authorization': `Bearer ${response.data.access_token}`}}).then(response => {

            for (var i in response.data) {
                appUsers.push({"email": response.data[i].email, "user_id": response.data[i].user_id});
            }

            // console.log(appUsers);
            res.status(200).json(appUsers).end();
        }).catch(err => {
            console.log(err);
            res.status(401).type('json').send(err);
        });
    }).catch(err => {
        console.log(err);
        res.status(401).type('json').send(err);
    });
});

module.exports = router;
