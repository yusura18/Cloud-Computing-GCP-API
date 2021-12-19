const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('../lib/datastore');

const datastore = ds.datastore;

const BOAT = "Boats";
const LOAD = "Loads";
const baseURL = "https://final-moorbrea.wl.r.appspot.com";

router.use(bodyParser.json());

/* ------------- Begin load Model Functions ------------- */

/**
 * Function to create a new load
 * @param {number} volume of the load
 * @param {string} content of the load
 * @param {string} date the load was created MM/DD/YYYY
 */
function post_load(volume, content, date) {
    var key = datastore.key(LOAD);
    const load = { "volume": parseInt(volume), "carrier": null, "content": content, "creation_date": date };
    const new_load = { "key": key, "data": load };
    return datastore.insert(new_load).then(() => { return key });
}

/**
 * Function to get boat information for loads list
 * @param {number} boat_id
 */
function get_boat_info(boat_id) {
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);
    return datastore.get(boat_key).then((boat) => {
        return boat;
    })
}

/**
 * Function to get an array of loads from database
 */
function get_loads(req) {
    const count_q = datastore.createQuery(LOAD).select('__key__');
    return datastore.runQuery(count_q).then((loads) => {
        const count = loads[0].length;
        // console.log("Loads count: " + count);

        const q = datastore.createQuery(LOAD).limit(5);
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
                    // Get carrier boat name
                    if (results.items[i].carrier !== null) {
                        get_boat_info(results.items[i].carrier[0].id).then((boat) => {
                            results.items[i].carrier[0]["name"] = boat[0].name;
                            results.items[i].carrier[0]["self"] = baseURL + "/boats/" + results.items[i].carrier[0].id;
                        });                
                    }
                
                    // Add "self" attribute for each load                
                    results.items[i]["self"] = req.protocol + "://" + req.get("host") + "/loads/" + results.items[i].id;
                }
    
                // Add count variable for loads
                // console.log(count);
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
 * Function to get a single load object using given id.
 * @param {number} id of a load
 * @returns array of length 1
 *      If a load with passed ID exists, then the element in the array is that load
 *      If no load with passed ID exists, then the value of the element is undefined 
 */
function get_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {

        // add load id to entity object
        if (entity[0] === undefined || entity[0] === null) {
            // No entity found. Don't try to add the id attribute
            return entity;
        } else {
            // console.log(entity);
            const load = entity.map(ds.fromDatastore);
            // console.log(load[0]);
            if (load[0] !== undefined || load[0] !== null) {

                if (load[0].carrier != null || load[0].carrier != undefined) {
                    // Add boat name & "self" attribute for carrier boat assigned this load
                    // console.log(load[0].carrier);
                    var boat_id = load[0].carrier[0].id;
                    var boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);
                    return datastore.get(boat_key).then((boat) => {
                        load[0].carrier[0]["name"] = boat[0].name;
                        load[0].carrier[0]["self"] = baseURL + "/boats/" + load[0].carrier[0].id;

                        // Add "self" attribute for load
                        load[0]["self"] = baseURL + "/loads/" + load[0].id;
                        return load;
                    });
                } else {
                    // Add "self" attribute for load
                    load[0]["self"] = baseURL + "/loads/" + load[0].id;
                    return load;
                }          
            }
        }
    });
}

/**
 * Function to edit load via a PATCH request
 * @param {number} id value of load 
 * @param {object} data is an object with the updated attributes of the load
 */
function patch_load(id, data) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.upsert({ "key": key, "data": data }).then(() => { return key });
}

/**
 * Function to edit a load via a PUT request
 * @param {number} id of the load
 * @param {object} data is the updated load attributes
 */
 function put_load(id, data) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.upsert({ "key": key, "data": data }).then(() => { return key });
}


/**
 * Function to delete a load using given id
 * @param {number} id value of load
 */
function delete_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);    
    return datastore.delete(key).then(() => { return key });
}

/**
 * Function to update the list of loads for a given boat
 * @param {number} boat_id is the id of the boat
 * @param {number} load_id is the id of the load
 */
function update_boat_loads(boat_id, load_id) {
    const boat_key = datastore.key([BOAT, parseInt(boat_id, 10)]);
    return datastore.get(boat_key).then((boat) => {                                      
        for (var i in boat[0].loads) {
            if (boat[0].loads[i].id == parseInt(load_id, 10)) {
                boat[0].loads.splice(i, 1);
                if (boat[0].loads.length === 0) {
                    var new_loads = null;
                    boat[0].loads = new_loads;
                }
                return datastore.save({"key": boat_key, "data": boat[0]});
            }
        }
    });
}

/**
 * Function to test whether a date string is the correct
 * format of MM/DD/YYYY
 */
function is_valid_date(date) {
    var date_regex = /^((1[0-2]|0[1-9])[/](3[01]|[12][0-9]|0[1-9])[/][0-9]{4})*$/;
    return date_regex.test(date);
}

/**
 * Function to validate query parameters
 * @param volume of the load - positive number
 * @param content of the load - type string
 * @param date of the creation of the load - string MM/DD/YYYY
 */
function validate_params(volume, content, date) {
    var msg = "OK";

    // Validate content attribute
    if (typeof content !== 'string' || content.length > 75) {
        msg = "The attribute content must be a string of at most 75 characters";
    
    // Validate date attribute
    } else if (typeof date === 'string') {
        if (is_valid_date(date)) {
            // Date attribute is valid
            // Validate volume attribute
            if (typeof volume !== "number" || volume <= 0) {
                msg = "The attribute volume must be a number greater than zero";
            }
        } else {
            msg = "The attribute creation_date must be in the format MM/DD/YYYY";
        }
    } else {
        msg = "The attribute creation_date must be a string";
    }
    // console.log(msg);
    return msg;
}

/**
 * Function to validate query parameters for PATCH request
 * @param volume of the load - positive number
 * @param content of the load - type string
 * @param date of the creation of the load - string MM/DD/YYYY
 */
function validate_patch_params(volume=0, content='', date='01/01/2021') {
    var msg = "OK";

    // Validate content attribute
    if (typeof content !== 'string' || content.length > 75) {
        msg = "The attribute content must be a string of at most 75 characters";
    
    // Validate date attribute
    } else if (typeof date === 'string') {
        if (is_valid_date(date)) {
            // Date attribute is valid
            // Validate volume attribute
            if (typeof volume !== "number" || volume < 0) {
                msg = "The attribute volume must be a number greater than zero";
            }
        } else {
            msg = "The attribute creation_date must be in the format MM/DD/YYYY";
        }
    } else {
        msg = "The attribute creation_date must be a string";
    }
    // console.log(msg);
    return msg;
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.get('/loads', function(req, res) {
    // Check request content type
    if (req.get('content-type') !== 'application/json') {
        res.status(415).send('Server only accepts application/json data.');
    }

    // Confirm accepts json
    const accepts = req.accepts('application/json');
    if (!accepts) {
        res.status(406).send('Not Acceptable');
    }
    
    const loads = get_loads(req)
        .then((loads) => {
            res.status(200).json(loads).end();
        });
});

router.get('/loads/:load_id', function(req, res) {
    get_load(req.params.load_id)
        .then((load) => {
            const accepts = req.accepts("application/json");
            if (!accepts) {
                res.status(406).send('Not Acceptable');
            } else if (accepts === 'application/json') {
                // console.log(load);
                if (load[0] === undefined || load[0] === null) {
                    // 0th element is undefined. There is no boat with this id
                    res.status(404).json({ "Error": "No load with this load_id exists" }).end();
                } else {
                    res.status(200).json(load[0]).end();
                }    
            } else {
                res.status(500).send('Server Error');
            }
        });
});

router.post('/loads', function(req, res) {
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
    } else if (!req.body.volume || !req.body.content || !req.body.creation_date) {
        res.status(400).json({ "Error": "The request object is missing at least one of the required attributes" }).end();
    } else { 
        const msg = validate_params(req.body.volume, req.body.content, req.body.creation_date);
        if (msg === "OK") {
            const key = post_load(req.body.volume, req.body.content, req.body.creation_date)
            .then((key) => {
                var data = datastore.get(key);
                data.then(load => {
                    res.status(201).type('json').send('{ "id": ' + key.id + ', "volume": ' + load[0].volume + ', "carrier": ' + load[0].carrier + ', "content": "' + load[0].content + '", "creation_date": "' + load[0].creation_date + '", "self": "https://' + req.get("host") + '/loads/' + key.id + '" }').end();             
                });
            });    
        } else {
            // console.log(msg);
            res.status(400).type('json').send({"Error": msg}).end();
        }
    } 
});

router.patch('/loads', function(req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.patch('/loads/:load_id', function(req, res) {
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
    } else if (req.params.load_id && (req.body.volume || req.body.content || req.body.creation_date)) {
        get_load(req.params.load_id).then((load) => {
            if (load[0] === undefined || load[0] === null) {
                res.status(404).json({ "Error": "No load with this load_id exists"}).end();
            } else {
                // console.log("Prev Load: " + load[0]);                
                const msg = validate_patch_params(req.body.volume, req.body.content, req.body.creation_date);
                // console.log(msg);
                if (msg === "OK") {
                    for (var i in req.body) {
                        // console.log(req.body[i]);
                        if (req.body[i] !== undefined || req.body[i] !== null) {
                            load[0][i] = req.body[i];
                        }
                    }
                    // console.log("New load: " + load[0]);
                    const key = patch_load(req.params.load_id, load[0])
                    .then((key) => {
                        var data = datastore.get(key);
                        data.then(load => {
                                res.status(200).type('json').send('{ "id": ' + key.id + ', "volume": ' + load[0].volume + ', "carrier": ' + load[0].carrier + ', "content": "' + load[0].content + '", "creation_date": "' + load[0].creation_date + '", "self": "https://' + req.get("host") + '/loads/' + key.id + '" }').end();             
                        });    
                    });
                } else {
                    res.status(400).type('json').send({ "Error": msg }).end();
                }
            }
        });
    } else {
        res.status(400).send({ "Error": "The request object is missing at least one of the required attributes" }).end();
    }
});

router.put('/loads', function(req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

router.put('/loads/:load_id', function(req, res) {
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
    } else if (!req.params.load_id || !req.body.volume || !req.body.content || !req.body.creation_date) {
        res.status(400).send({"Error": "The request object is missing at least one of the required attributes" }).end();
    } else {
        get_load(req.params.load_id)
        .then((load) => {
            if (load[0] === undefined || load[0] === null) {
                res.status(404).json({ "Error": "No load with this load_id exists" }).end();
            } else {
                const msg = validate_params(req.body.volume, req.body.content, req.body.creation_date);
                // console.log(msg);
                if (msg === "OK") {
                    const updated_load = {"volume": req.body.volume, "content": req.body.content, "creation_date": req.body.creation_date, "carrier": load[0].carrier};
                    put_load(req.params.load_id, updated_load)
                    .then((key) => {
                        var data = datastore.get(key);
                        data.then(load => {
                            res.status(200).type('json').send('{ "id": ' + key.id + ', "volume": ' + load[0].volume + ', "carrier": ' + load[0].carrier + ', "content": "' + load[0].content + '", "creation_date": "' + load[0].creation_date + '", "self": "https://' + req.get("host") + '/loads/' + key.id + '" }').end();
                        });                        
                    });
                } else {
                    res.status(400).type('json').send({ "Error": msg }).end();
                }
            }
        });
    }
});

router.delete('/loads', function(req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});


router.delete('/loads/:load_id', function(req, res) {
    const load = get_load(req.params.load_id)
        .then(load => {
            if (load[0] === null|| load[0] === undefined) {
                res.status(404).json({ "Error": "No load with this load_id exists" }).end();
            } else {
                // call function to delete load from boat
                if (load[0].carrier !== null) {
                    update_boat_loads(load[0].carrier[0].id, req.params.load_id).then(() => {
                        delete_load(req.params.load_id).then(res.status(204).end());
                    });
                } else {
                    delete_load(req.params.load_id).then(res.status(204).end());
                }
            }
        });
});

/* ------------- End Controller Functions ------------- */

module.exports = router;

