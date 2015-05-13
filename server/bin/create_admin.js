var path = require('path');
var app = require(path.resolve(__dirname, '../server'));
var Role = app.models.Role;
var RoleMapping = app.models.RoleMapping;
var User = app.models.User;
var adminEmails = require('./admin_emails.js');

//Temporary until we add ui flow for creating admins
User.find({
  where: {
    email: {inq: adminEmails}
  }
}, function(err, users){
  Role.findOne({
    name: 'admin'
  }, function(err, role){
    if (err) throw err;

    console.log('Found admin role:', role);

    users.forEach(function(user){
      // Make Esco an admin
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: user.id
      }, function(err, principal) {
          if (err) throw err;
          console.log('Created principal:', principal);
      });
    });
  });
});
