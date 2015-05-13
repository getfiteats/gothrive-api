var path = require('path');
var sendgrid  = require('sendgrid')(process.env.SENDGRID_API_KEY);
var angularTemplate = require('angular-template');

var FROM_EMAIL = process.env.FROM_EMAIL;
var TEMPLATES = {
  WELCOME: process.env.WELCOME_EMAIL_TEMPLATE,
  ORDER: process.env.ORDER_EMAIL_TEMPLATE
};

var mail = {};

mail.welcome = function welcome(user, cb) {
  var payload   = {
    to      : user.email,
    from    : FROM_EMAIL,
    subject : 'Welcome to GoThrive!',
    html: 'Cheers,<br />GoThrive.',
    text: 'Cheers, GoThrive'
  };

  var firstName = user.name.first;
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  var email = new sendgrid.Email(payload);
  email.addSubstitution(':name', firstName);
  email.setFilters({
    'templates': {
      'settings': {
        'enable': 1,
        'template_id' : TEMPLATES.WELCOME
      }
    }
  });

  sendgrid.send(email, function(err, json) {
    if (err) {
      return cb(err);
    }

    return cb(null, json);
  });
}

mail.order = function order(user, order, cb) {
  var payload   = {
    to      : user.email,
    from    : FROM_EMAIL,
    subject : 'Your food is on it\'s way!'
  };

  var firstName = user.name.first;
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  var email = new sendgrid.Email(payload);
  email.addSubstitution(':name', firstName);
  email.setFilters({
    'templates': {
      'settings': {
        'enable': 1,
        'template_id' : TEMPLATES.ORDER
      }
    }
  });

  var html = require('fs').readFileSync(path.resolve(__dirname, './email-templates/order.tpl.html'));
  email.setHtml(angularTemplate(html, {order: order}));

  sendgrid.send(email, function(err, json) {
    if (err) {
      return cb(err);
    }

    return cb(null, json);
  });
}

module.exports = mail;
