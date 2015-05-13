module.exports = function(app) {
  var passport = require('loopback-component-passport/node_modules/passport');
  var authUtils = require('loopback-component-passport/lib/models/utils');
  var PassportConfigurator = require('loopback-component-passport').PassportConfigurator;
  var providers = require('../providers');
  var passportConfigurator = new PassportConfigurator(app);

  // Initialize passport
  passportConfigurator.init();

  // Set up related models
  passportConfigurator.setupModels({
    userModel: app.models.user,
    userIdentityModel: app.models.userIdentity,
    userCredentialModel: app.models.userCredential
  });

  Object.keys(providers).forEach(function(strategy) {
    var opts = providers[strategy];

    opts.session = opts.session !== false;

    if (opts.provider === "facebook") {
      opts.profileToUser = facebookProfileToUser;
      opts.customCallback = customCallback(strategy, opts);
    }
    
    passportConfigurator.configureProvider(strategy, opts);
  });
  
  function facebookProfileToUser(provider, profile) {
    var email;
    var name;
    var image;
    var username;
    var password;
    var userObj;
    var names;

    try {
      email = profile.email || profile.emails[0].value;
    } catch(err){
      email = (profile.username || profile.id) + '@loopback.' +
              (profile.provider || provider) + '.com';
    }
  
    if (typeof profile.name === 'string') {
      names = profile.name.split(' ');
      name = {
        first: names[0],
        last: names[1]
      };
    } else { 
      name = {
        first: profile.name.givenName,
        last: profile.name.familyName
      };
    }

    if (/facebook/.test(provider)) {
      try {
        image = {
          url: 'https://graph.facebook.com/' + profile.id + '/picture',
        };
      } catch(err){}
    }

    username = provider + '.' + (profile.username || profile.id);
    password = authUtils.generateKey('password');
    userObj = {
      username: username,
      password: password,
      email: email
    };

    if (name) {
      userObj.name = name;
    }

    if (image) {
      userObj.image = image;
    }
    return userObj;
  }

  function customCallback(strategy, opts) {
    return function(req, res, next) {
      passport.authenticate(
        strategy,
        {session: false},
        function(err, user, info) {
          var redirect;
          
          if (err) {
            return next(err);
          }
          if (!user) {
            return res.redirect(opts.failureRedirect);
          }
        
          redirect = opts.successRedirect + '?access_token=' + info.accessToken.id + '&userId=' + user.id.toString();
          return res.redirect(redirect);
        }
      )(req, res, next);
    };
  }
}