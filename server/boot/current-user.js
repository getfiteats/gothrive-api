var loopback = require('loopback');

module.exports = function setCurrentUser(app) {
  app.use(loopback.token({model: app.models.accessToken}));
  app.use(function setCurrentUser(req, res, next) {
    if (!req.accessToken) {
      return next();
    }
    app.models.User.findById(req.accessToken.userId, function(err, user) {
      if (err) {
        return next(err);
      }
      if (!user) {
        return next(new Error('No user with this access token was found.'));
      }
      var loopbackContext = loopback.getCurrentContext();
      if (loopbackContext) {
        loopbackContext.set('currentUser', user);
      }
      next();
    });
  });
};
