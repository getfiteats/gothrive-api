var path = require('path');
var loopback = require('loopback');
var stripe = require('../stripe');
var _ = require('lodash');
var FB = require('fb');
var providers = require('../../server/providers');
var mail = require(path.resolve(__dirname, '../mail'));

module.exports = function(User) {

  User.signUp = function(email, password, cb) {
    var newUser = {};
    newUser.email = email.toLowerCase();
    newUser.password = password;

    User.create(newUser, function (err, user) {
      if (err) {
        return cb(err);
      }
      
      sendWelcomeEmail(user);
      
      User.login(newUser, function(err, token){
        if (err) {
          return cb(err);
        }

        return cb(null, { userId: user.id, accessToken: token.id });
      });
    });
  };

  User.remoteMethod('signUp', {
    http: {path: '/signUp', verb: 'post'},
    accepts: [
      {arg: 'email', type: 'string'},
      {arg: 'password', type: 'string'}
    ],
    returns: {type: 'object', root: true}
  });

  User.facebookLogin = function(provider, facebookAccessToken, cb) {
    var userIdentity = User.app.models.userIdentity;
    var authScheme = 'oAuth 2.0';
    var credentials = { accessToken: facebookAccessToken };
    var options = providers[provider];

    FB.api('/me', { fields: ['id', 'name', 'email', 'gender'], access_token: facebookAccessToken }, function(profile){
      if (!profile || profile.error) {
        return cb(profile.error || new Error("could not login"));
      }

      userIdentity.login(provider, authScheme, profile, credentials, options, function(err, user, identity, token){
        return cb(err, { userId: user.id, accessToken: token.id }); 
      })
    });
  };

  User.remoteMethod('facebookLogin', {
    http: {path: '/facebookLogin', verb: 'post'},
    accepts: [
      {arg: 'provider', type: 'string'},
      {arg: 'facebookAccessToken', type: 'string'}
    ],
    returns: {type: 'object', root: true}
  });

  User.addLocation = function addLocation(placeId, variant, giveaway, cb) {
    var GooglePlace = User.app.models.GooglePlace;
    GooglePlace.findOne(placeId, function(err, place) {
      if (err) {
        return cb(err);
      }

      var ctx = loopback.getCurrentContext();
      var currentUser = ctx && ctx.get('currentUser');
      if (!currentUser) {
        return cb(new Error('Current user not available'));
      }

      currentUser.locations = currentUser.locations || [];
      var matchedLocation = _.findWhere(currentUser.locations, {street: place.address.street});
      if (matchedLocation && matchedLocation.street) {
        return cb(null, currentUser);
      }

      currentUser.locations.push({
        country: place.address.country,
        street: place.address.street,
        city: place.address.city,
        state: place.address.state,
        zip: place.address.zip,
        lng: place.geo.coordinates[0],
        lat: place.geo.coordinates[0]
      });

      currentUser.marketSrc = {
        variant: variant,
        giveaway: giveaway
      };

      var user = new User(currentUser);
      delete currentUser.id;
      user.updateAttributes(currentUser, function(err, savedUser) {
        if (err) {
          return cb(err);
        }

        return cb(null, savedUser);
      });

    });
  };

  User.remoteMethod('addLocation', {
    http: {path: '/addLocation', verb: 'post'},
    accepts: [
      {arg: 'placeId', type: 'string'},
      {arg: 'variant', type: 'string'},
      {arg: 'giveaway', type: 'string'}
    ],
    returns: {type: 'object', root: true}
  });

  User.getPaymentMethods = function(customerId, cb) {
    stripe.customers.listCards(customerId, function(err, response){
      var cards = response.data;
      cb(err, cards);
    });
  }

  User.remoteMethod('getPaymentMethods', {
    http: {path: '/paymentMethods', verb: 'get'},
    accepts: {arg: 'customerId', type: 'string'},
    returns: {type: 'array', root: true}
  });

  User.getDefaultPaymentMethod = function(customerId, cb) {
    stripe.customers.retrieve(customerId, function(err, customer){
      if (err) {
        return cb(err);
      }

      stripe.customers.retrieveCard(customer.id, customer.default_source, function(err, card){
        if (err) {
          return cb(err);
        }
        cb(null, card);
      });
    });
  }

  User.remoteMethod('getDefaultPaymentMethod', {
    http: {path: '/defaultPaymentMethod', verb: 'get'},
    accepts: {arg: 'customerId', type: 'string'},
    returns: {type: 'object', root: true}
  });

  User.addPaymentMethod = function(userId, token, cb) {
    User.findOne({ where: {id: userId}}, function(err, user){
      if (!err && !user) {
        err = new Error("User does not exist");
        return cb(err);
      }

      if (!user.payment || !user.payment.customerId) {
        return createCustomer(user, token, cb);
      }

      stripe.customers.createSource(user.payment.customerId, { source: token }, function(err, card){
        cb(err, { id: card.id });
      });
    });
  }

  User.remoteMethod('addPaymentMethod', {
    http: {path: '/paymentMethod', verb: 'post'},
    accepts: [
      {arg: 'userId', type: 'string'},
      {arg: 'token', type: 'string'}
    ],
    returns: {type: 'object', root: true}
  });

  function createCustomer (user, token, cb) {
    var data = {
      source: token,
      description: user.id.toString(),
      //email: user.email,
    };

    stripe.customers.create(data, function(err, customer){
      var data;

      if (err) {
        return cb(err);
      }

      data = {
        payment: {
          src: 'stripe',
          customerId: customer.id
        }
      };

      user.updateAttributes(data, function(err, instance){
        if (err) {
          return cb(err);
        }
        cb(null, { id: customer.default_source });
      });
    });
  }

  function sendWelcomeEmail(user, cb) {
    mail.welcome(user, function(err) {
      if (err) {
        console.log('Could not send user welcome email ', err);
      }

      console.log('Welcome email sent to ' + user.id);
      if (cb) {
        cb(err);
      }
    });
  }

};
