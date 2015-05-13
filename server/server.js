require('newrelic');
var os = require('os');
var path = require('path');
var loopback = require('loopback');
var boot = require('loopback-boot');
var app = module.exports = loopback();

// Include passport before boot to avoid UserIdentity model issue
// https://github.com/strongloop/loopback-example-passport/issues/5
var passport = require('loopback-component-passport/node_modules/passport');
var PassportConfigurator = require('loopback-component-passport').PassportConfigurator;

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, '../client'));

// Create a LoopBack context for all requests
app.use(loopback.context());

// Bootstrap the application, configure models, providers, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname);

//require('./setup-providers')(app);

// Enable http session
app.use(loopback.session({ secret: 'xRKM6vAZtwNr' }));


app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    console.log('Web server listening at: %s', app.get('url'));
  });
};

// start the server if `$ node server.js`
if (require.main === module) {
  app.start();
}
