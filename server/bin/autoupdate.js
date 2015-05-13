var path = require('path');
var app = require(path.resolve(__dirname, '../server'));
var dataSource = app.dataSources.mongodb;

dataSource.autoupdate('brand', function(err) {
  if (err) {
    console.log(err);
  } else {
    console.log('updated brand');
  }
});

dataSource.autoupdate('location', function(err) {
  if (err) {
    console.log(err);
  } else {
    console.log('updated location');
  }
});
