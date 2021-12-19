const {Datastore} = require('@google-cloud/datastore');

const projectId = 'final-moorbrea';

module.exports.Datastore = Datastore;
module.exports.datastore = new Datastore({projectId:projectId});

// Helper function to grab key 
module.exports.fromDatastore = function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}
