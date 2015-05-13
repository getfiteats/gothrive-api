var path = require('path');
var app = require(path.resolve(__dirname, '../server'));
var Role = app.models.Role;

//Move this to some place in the serve.js or create a boot file
Role.validatesUniquenessOf('name');

function createRole(role, cb) {
  Role.create(role, function(err, createdRole) {
    if (err) {
      console.log('Error - Role could not be created: ' + err.message);
      return cb(err, createdRole);
    }

    console.log('Created role:', createdRole.name);
    return cb(err, createdRole);
  });
};

createRole({name: 'admin'}, function(err, createdRole) {
});
