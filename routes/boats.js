const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('../lib/datastore');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const dotenv = require('dotenv');

dotenv.config();

const datastore = ds.datastore;

const BOAT = "Boats";
const LOAD = "Loads";
const baseURL = "https://final-moorbrea.wl.r.appspot.com";

router.use(bodyParser.json());

// JWT Validation
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    }),

    // validate the audience and the issuer

    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
});

/* ------------- Begin Boat Model Functions ------------- */
/**
 * Function to create a new boat
 * @param {string} name of boat
 * @param {string} type of boat
 * @param {integer} length of boat 
 * @param {string} owner is the sub property of a valid JWT
 */
function post_boat(name, type, length, owner) {
    const key = datastore.key(BOAT);
    const boat = { "name": name, "type": type, "length": length, "owner": owner, "loads": null }; 
    const new_boat = { "key": key, "data": boat };
    return datastore.insert(new_boat).then(() => { return key });
}

/**
 * Function to get an array of boats from datastore
 */
function get_boats(req) {
    const count_q = datastore.createQuery(BOAT).filter('owner', '=', req.user.sub);
    return datastore.runQuery(count_q).then((counts) => {
        const count = counts[0].length;
        // console.log("Boat count: " + count);

        const q = datastore.createQuery(BOAT).filter('owner', '=', req.user.sub).limit(5);
        const results = {};

        if (Object.keys(req.query).includes("cursor")) {
            q = q.start(req.query.cursor);
        }
        return datastore.runQuery(q).then((entities) => {
            // map call fromDatastore to add id attribute to every element in the array
            // at element 0 of the variable entities
    
            if (entities[0] === undefined || entities[0] === null) {
                // No entities found. Don't try to add the id attribute
                return entities;
            } else {
                results["items"] = entities[0].map(ds.fromDatastore);
                
                // Add "self" links to results
                for (var i = 0; i < results.items.length; i++) {
                    if (results.items[i].loads !== null) {
                        for (var j in results.items[i].loads) {
                            // Add "self" link for each load
                            results.items[i].loads[j]["self"] = baseURL + "/loads/" + results.items[i].loads[j].id;
                        }
                    }
                    // Add "self" attribute for each boat                
                    results.items[i]["self"] = baseURL + "/boats/" + results.items[i].id;
                }
    
                // Add count variable for all the boats owned by validated user
                results["count"] = count;
    
                // Add pagination link
                if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
                    results["next"] = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
                }
    
                return results;
            }
        });    
    });
}

/**
 * Function to get a single boat object using given id.
 * @param {number} id Int ID value
 * @returns array of length 1
 *      If a boat with passed ID exists, then the element in the array is that boat
 *      If no boat with passed ID exists, then the value of the element is undefined 
 */
function get_boat(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {

        // add boat ID to entity object
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            const boat = entity.map(ds.fromDatastore);

            if (boat[0] !== undefined || boat[0] !== null) {
                // Add "self" attribute for each load assigned to this boat
                if (boat[0].loads !== null || boat[0].loads !== undefined) {

                    for (var i in boat[0].loads) {
                        boat[0].loads[i]["self"] = baseURL + "/loads/" + boat[0].loads[i].id;
                    }
                }
                // console.log(boat[0]);
                // Add "self" attribute for boat
                boat[0]["self"] = baseURL + "/boats/" + boat[0].id;
            }

            return boat;            
        } 
    });
}

/**
 * Function to get a single boat's list of assigned loads using given boat id.
 * @param {number} id of boat
 */
function get_boat_loads(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    
    return datastore.get(key).then((entity) => {

        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return entity;
        } else {
            var load_keys = [];
            const boat = entity[0];
            // console.log(boat);
            // Check if there are no loads assigned to boat
            if (boat.loads === null) {
                return boat.loads;
            } else {
                for (var i in boat.loads) {
                    load_keys.push(datastore.key([LOAD, parseInt(boat.loads[i].id, 10)]));
                }
                return datastore.get(load_keys).then((loads) => {
                    var results = [];
                    results = loads[0].map(ds.fromDatastore);
                    // console.log(results);
                    for (var j in results) {
                        results[j]["self"] = baseURL + "/loads/" + results[j].id;
                        results[j].carrier[0]["name"] = boat.name;
                        results[j].carrier[0]["self"] = baseURL + "/boats/" + results[j].carrier[0].id;
                    }
                    // console.log(results);
                    return results; 
                });                        
            }
        }
    });    
}

/**
 * Function to edit a boat via a PATCH request
 * @param {integer} id value of boat 
 * @param {object} data is an object with updated attributes of the boat
 */
 function patch_boat(id, data) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.upsert({ "key": key, "data": data }).then(() => { return key });
}

/**
 * Function to edit a boat via a PUT request
 * @param {integer} id value of boat 
 * @param {object} data is the updated boat attributes
 */
function put_boat(id, data) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.upsert({ "key": key, "data": data }).then(() => { return key });
}

/**
 * Function to delete a boat using given id
 * @param {number} id Int ID value
 */
function delete_boat(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);    
    return datastore.delete(key).then(() => { return key });
}

/**
 * Function to add load to boat with given id
 * @param {number} boat_id is the id of the boat
 * @param {number} load_id is the id of the load to be added to the boat
 */
function put_load(boat_id, load_id) {
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);    
    return datastore.get(boat_key).then((boat) => {
        const load_key = datastore.key([LOAD, parseInt(load_id, 10)]);
        return datastore.get(load_key).then((load) => {
            if (load[0].carrier == null || load[0].carrier == undefined) {
                var new_carrier = [];
                new_carrier.push({"id": parseInt(boat_id, 10)});
                // console.log(new_carrier);
                var updated_load = { "volume": load[0].volume, "carrier": new_carrier, "content": load[0].content, "creation_date": load[0].creation_date };
                // console.log(updated_load);
                return datastore.save({ "key": load_key, "data": updated_load }).then(() => {
                    var current_loads = boat[0].loads;            
                    if (current_loads == null || current_loads == undefined) {
                        current_loads = [];
                    }
                    current_loads.push({"id": parseInt(load_id, 10)});
                    // console.log(current_loads);
                    var new_boat = { "name": boat[0].name, "type": boat[0].type, "length": boat[0].length, "owner": boat[0].owner, "loads": current_loads };
                    // console.log(new_boat);
                    return datastore.save({ "key": boat_key, "data": new_boat });        
                });
            }
        });                
    });
}

/**
 * Check if load id exists
 * @param {number} load_id 
 */
function check_load(load_id) {
    const key = datastore.key([LOAD, parseInt(load_id, 10)]);
    return datastore.get(key).then((load) => {
        return load;
    });
}

/**
 * Function to remove a load from a boat with given id
 * @param {number} boat_id is the id of the boat
 * @param {number} load_id is the id of the load to be removed from boat
 */
function remove_load(boat_id, load_id) {
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);
    return datastore.get(boat_key).then((boat) => {        
        if (boat[0].loads != null || boat[0].loads != undefined) {
            for (var i in boat[0].loads) {
                if (boat[0].loads[i].id === parseInt(load_id, 10)) {
                    update_load(load_id);                    
                    boat[0].loads.splice(i, 1);
                    // console.log(boat[0].loads);
                    if (boat[0].loads.length === 0) {
                        var new_loads = null;
                        boat[0].loads = new_loads;
                        // console.log(boat[0].loads);
                    }
                    // console.log(boat[0]);
                    return datastore.save({"key": boat_key, "data": boat[0]});
                }
            }
        }    
    });
}

/**
 * Function to update load carrier when load is removed from boat
 * @param {number} load_id is the id of the load 
 */
function update_load(load_id) {
    const load_key = datastore.key([LOAD, parseInt(load_id, 10)]);
    return datastore.get(load_key).then((load) => {
        load[0].carrier = null;
        return datastore.save({"key": load_key, "data": load[0]});
    });
}

/**
 * Function to remove all loads from a boat
 * @param {number} boat_id is the id of the boat
 */
function remove_all_loads(boat_id) {
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);
    return datastore.get(boat_key).then((boat) => {
        if (boat[0].loads != null || boat[0].loads != undefined) {
            for (var i in boat[0].loads) {
                update_load(boat[0].loads[i].id);
            }
            boat[0].loads = null;
            return datastore.save({"key": boat_key, "data": boat[0] });                
        }
    });
}

/**
 * Function to test whether a string contains special
 * characters
 */
 function is_valid_str(str) {
    // ^[a-zA-Z0-9 ]*$
    return !/[~`!@#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?()\._]/g.test(str);
}

/**
 * Function to validate query parameters
 * @param name of the boat
 * @param type of the boat
 * @param length of the boat 
 */
function validate_params(name, type, length) {
    var msg = "OK";

    const query = datastore.createQuery(BOAT);
    return datastore.runQuery(query).then((result) => {       
        for (var i in result[0]) {
            // console.log(result[0][i]);
            if (result[0][i].name === name) {
                msg = "403";
                return msg;
            } 
        }                
        
        // This is a unique boat name
        // Validate name attribute
        if (typeof name !== 'string' || name.length > 30) {
            msg = "The attribute name must be a string of at most 30 characters";
        } else if (!is_valid_str(name)) {
            msg = "The attribute name must not contain special characters";

        // Validate type attribute
        } else if (typeof type === 'string' && type.length <= 30) {
            if (is_valid_str(type)) {
                // Type attribute is valid
                // Validate length attribute
                if (typeof length !== 'number' || length <= 0) {
                    msg = "The attribute length must be a number greater than zero";
                }
            } else {
                msg = "The attribute type must not contain special characters";
            }
        } else {
            msg = "The attribute type must be a string of at most 30 characters";
        }
        // console.log(msg);
        return msg;
    });        
}

/**
 * Function to validate query parameters for PATCH request
 * @param name of the boat
 * @param type of the boat
 * @param length of the boat 
 */
function validate_patch_params(name='', type='', length=0) {
    var msg = "OK";

    const query = datastore.createQuery(BOAT);
    return datastore.runQuery(query).then((result) => {       
        for (var i in result[0]) {
            // console.log(result[0][i]);
            if (result[0][i].name === name) {
                msg = "403";
                return msg;
            } 
        }                
        
        // This is a unique boat name
        // Validate name attribute
        if (typeof name !== 'string' || name.length > 30) {
            msg = "The attribute name must be a string of at most 30 characters";
        } else if (!is_valid_str(name)) {
            msg = "The attribute name must not contain special characters";

        // Validate type attribute
        } else if (typeof type === 'string' && type.length <= 30) {
            if (is_valid_str(type)) {
                // Type attribute is valid
                // Validate length attribute
                if (typeof length !== 'number' || length < 0) {
                    msg = "The attribute length must be a number greater than zero";
                }
            } else {
                msg = "The attribute type must not contain special characters";
            }
        } else {
            msg = "The attribute type must be a string of at most 30 characters";
        }
        // console.log(msg);
        return msg;
    });        
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.get('/boats', checkJwt, function(req, res) {
    // Check request content type
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    }

    // Confirm accepts json
    const accepts = req.accepts('application/json');
    if (!accepts) {
        res.status(406).send('Not Acceptable');
    }

    get_boats(req)
        .then((boats) => {
            res.status(200).json(boats).end();
        });
});

router.get('/boats/:boat_id', checkJwt, function(req, res) {
    get_boat(req.params.boat_id)
        .then((boat) => {
            const accepts = req.accepts("application/json");
            if (!accepts) {
                res.status(406).send("Not Acceptable");
            } else if (accepts === 'application/json') {
                if (boat[0] === undefined || boat[0] === null) {
                    // 0th element is undefined. There is no boat with this id
                    res.status(404).json({ "Error": "No boat with this boat_id exists" }).end();
                } else if (boat[0].owner !== req.user.sub) {
                    res.status(401).json({"Error": "Missing or invalid JWT" }).end();
                } else {
                    res.status(200).json(boat[0]).end();
                }    
            } else {
                res.status(500).send('Server Error');
            }
        });
});

router.get('/boats/:boat_id/loads', function(req, res) {
    // Check request content type
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    }

    // Confirm accepts json
    const accepts = req.accepts('application/json');
    if (!accepts) {
        res.status(406).send('Not Acceptable');
    }
    // Check JWT matches boat's owner
    get_boat(req.params.boat_id).then((boat) => {
        if (boat[0] === undefined || boat[0] === null) {
            // 0th element is undefined. There is no boat with this id
            res.status(404).json({ "Error": "No boat with this boat_id exists" }).end();
        } else {
            get_boat_loads(req.params.boat_id)
            .then((loads) => {
                if (loads[0] === undefined || loads[0] === null) {
                    res.status(404).json({ "Error": "No loads assigned to this boat"}).end();
                } else {
                    res.status(200).json(loads).end();
                }            
            });    
        }
    });
});

router.post('/boats', checkJwt, function(req, res) {
    // Check request content type
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    }

    // Confirm accepts json
    const accepts = req.accepts('application/json');
    if (!accepts) {
        res.status(406).send('Not Acceptable');
    }
    // Check query length
    // console.log(req.body);
    // console.log(Object.keys(req.body).length);
    if (Object.keys(req.body).length !== 3) {
        res.status(400).send({ "Error": "The request object contains invalid number of attributes" }).end();
    } else if (!req.body.name || !req.body.type || !req.body.length) {
        res.status(400).send({"Error": "The request object is missing at least one of the required attributes" }).end();
    } else {
        const msg = validate_params(req.body.name, req.body.type, req.body.length).then((msg) => {
            // console.log(msg);
            if (msg === "OK") {
                const key = post_boat(req.body.name, req.body.type, req.body.length, req.user.sub)
                .then((key) => {
                    const boat = datastore.get(key)
                    .then(boat => {
                        res.status(201).type('json').send('{ "id": ' + key.id + ', "name": "' + boat[0].name + '", "type": "' + boat[0].type + '", "length": ' + boat[0].length + ', "loads": ' + boat[0].loads + ', "owner": "' + boat[0].owner + '", "self": "https://' + req.get("host") + '/boats/' + key.id + '" }').end();             
                    });
                });
            } else if (msg === "403") {
                res.status(403).type('json').send({"Error": "A boat with the specified name already exists"}).end();
            } else {
                console.log(msg);
                res.status(400).type('json').send({"Error": msg}).end();
            }            
        });
    }
});

router.patch('/boats', function(req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.patch('/boats/:boat_id', checkJwt, function(req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    }
    
    const accepts = req.accepts('application/json');
    if (!accepts) {
        res.status(406).send('Not Acceptable');
    }

    // Check query length
    // console.log(req.body);
    // console.log(Object.keys(req.body).length);
    // console.log(Object.keys(req.body));
    if (Object.keys(req.body).length < 1 || Object.keys(req.body).length > 3) {
        res.status(400).json({ "Error": "The request object contains invalid number of attributes" }).end();
    } else if (req.params.boat_id && (req.body.name  || req.body.type || req.body.length)) {
        get_boat(req.params.boat_id)
        .then((boat) => {
            if (boat[0] === undefined || boat[0] === null ) {
                // 0th element is undefined. There is no boat with this id            
                res.status(404).json({ "Error": "No boat with this boat_id exists" }).end();
            } else if (boat[0].owner !== req.user.sub) {
                res.status(401).json({"Error": "Missing or invalid JWT" }).end();            
            } else {
                const msg = validate_patch_params(req.body.name, req.body.type, req.body.length).then((msg) => {
                    // console.log(msg);
                    // console.log("Previous data: " + boat[0]);                    
                    if (msg === "OK") {
                        for (var i in req.body) {
                            // console.log(req.body[i]);
                            if (req.body[i] !== undefined || req.body[i] !== null) {
                                boat[0][i] = req.body[i];
                            }
                        }
                        // console.log("New Data: " + boat[0]);                      
                        const key = patch_boat(req.params.boat_id, boat[0])
                        .then((key) => {
                            var data = datastore.get(key);
                            data.then(boat => {
                                res.status(200).type('json').send('{ "id": ' + key.id + ', "name": "' + boat[0].name + '", "type": "' + boat[0].type + '", "length": ' + boat[0].length + ', "owner": "' + boat[0].owner + '", "loads": ' + boat[0].loads + ', "self": "https://' + req.get("host") + '/boats/' + key.id + '" }').end();             
                            });
                        });
                    } else if (msg === "403") {
                        res.status(403).type('json').send({"Error": "A boat with the specified name already exists"}).end();
                    } else {
                        res.status(400).type('json').send({"Error": msg}).end();
                    }                        
                });
            }
        });
    } else {
        res.status(400).send({"Error": "The request object is missing at least one of the required attributes" }).end();
    }
});

router.delete('/boats', function(req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.delete('/boats/:boat_id', checkJwt, function(req, res) {
    const boat = get_boat(req.params.boat_id)
        .then(boat => {
            if (boat[0] === undefined || boat[0] === null) {
                res.status(404).json({ "Error": "No boat with this boat_id exists" }).end();
            } else if (boat[0].owner !== req.user.sub) {
                res.status(401).json({"Error": "Missing or invalid JWT" }).end();            
            } else {
                // call function to delete all loads from boat        
                remove_all_loads(req.params.boat_id)
                .then(() => {
                    delete_boat(req.params.boat_id).then(res.status(204).end());             
                });
            }
        });
});

router.put('/boats', function(req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.put('/boats/:boat_id', checkJwt, function(req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    }

    const accepts = req.accepts('application/json');
    if (!accepts) {
        res.status(406).send('Not Acceptable');
    }
    
    // Check query length
    // console.log(req.body);
    // console.log(Object.keys(req.body).length);
    if (Object.keys(req.body).length !== 3) {
        res.status(400).send({ "Error": "The request object contains invalid number of attributes" }).end();
    } else if (!req.params.boat_id || !req.body.name || !req.body.type || !req.body.length) {
        res.status(400).send({"Error": "The request object is missing at least one of the required attributes" }).end();
    } else {
        get_boat(req.params.boat_id)
        .then((boat) => {
            if (boat[0] === undefined || boat[0] === null ) {
                // 0th element is undefined. There is no boat with this id            
                res.status(404).json({ "Error": "No boat with this boat_id exists" }).end();
            } else if (boat[0].owner !== req.user.sub) {
                res.status(401).json({"Error": "Missing or invalid JWT" }).end();            
            } else {
                const msg = validate_params(req.body.name, req.body.type, req.body.length).then((msg) => {
                    // console.log(msg);
                    if (msg === "OK") {
                        const updated_boat = {"name": req.body.name, "type": req.body.type, "length": req.body.length, "owner": boat[0].owner, "loads": boat[0].loads};
                        const key = put_boat(req.params.boat_id, updated_boat)
                        .then((key) => {
                            var data = datastore.get(key);
                            data.then(boat => {
                                res.status(200).type('json').send('{ "id": ' + key.id + ', "name": "' + boat[0].name + '", "type": "' + boat[0].type + '", "length": ' + boat[0].length + ', "owner": "' + boat[0].owner + '", "loads": ' + boat[0].loads + ', "self": "https://' + req.get("host") + '/boats/' + key.id + '" }').end();             
                            });
                        });
                    } else if (msg === "403") {
                        res.status(403).type('json').send({"Error": "A boat with the specified name already exists"}).end();
                    } else {
                        res.status(400).type('json').send({"Error": msg}).end();
                    }                            
                });
            }
        });            
    }
});

router.put('/boats/:boat_id/loads/:load_id', checkJwt, function(req, res) {    
    const boat = get_boat(req.params.boat_id)
        .then(boat => {
            if (boat[0] === undefined || boat[0] === null) {
                res.status(404).json({ "Error": "The specified boat and/or load does not exist" }).end();
            } else if (boat[0].owner !== req.user.sub) {
                res.status(401).json({"Error": "Missing or invalid JWT" }).end();            
            } else {
                const load = check_load(req.params.load_id)
                .then(load => {
                    if (load[0] === undefined || load[0] === null) {
                        res.status(404).json({ "Error": "The specified boat and/or load does not exist" }).end();
                    } else if (load[0].carrier != null || load[0].carrier != undefined) {
                        res.status(403).json({ "Error": "The load has already been assigned to a boat" });
                    } else {
                        put_load(req.params.boat_id, req.params.load_id).then(res.status(204).end());                    
                    }
                });
            }
        });
});

router.delete('/boats/:boat_id/loads/:load_id', checkJwt, function(req, res) {
    const boat = get_boat(req.params.boat_id)
        .then(boat => {
            if (boat[0] === undefined || boat[0] === null) {
                res.status(404).json({ "Error": "The specified boat and/or load does not exist" }).end();
            } else if (boat[0].owner !== req.user.sub) {
                res.status(401).json({"Error": "Missing or invalid JWT" }).end();            
            } else {
                const load = check_load(req.params.load_id)
                    .then((load) => {
                        if (load[0] === undefined || load[0] === null) {
                            res.status(404).json({ "Error": "The specified boat and/or load does not exist" }).end();
                        } else if (load[0].carrier === null || load[0].carrier[0].id !== parseInt(req.params.boat_id, 10)) {
                            res.status(403).json({ "Error": "The load is not assigned to the specified boat" }).end();
                        } else {
                            remove_load(req.params.boat_id, req.params.load_id).then(res.status(204).end());
                        }
                    });                
            }
        });
});

/* ------------- End Controller Functions ------------- */

// Handle jwt errors
router.use(function (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
        res.status(401).type('application/json').send({ "Error": "Missing or invalid JWT" });
    }
});


module.exports = router;
