module.exports = function(app) {

  app.post('/signup', function (req, res, next) {

    var User = app.models.user;

    var newUser = {};
    newUser.email = req.body.email.toLowerCase();
    newUser.username = req.body.username.trim();
    newUser.password = req.body.password;

    User.create(newUser, function (err, user) {
      if (err) {
        return res.redirect('back');
      }

      mail.welcome(user, function(err) {
        if (err) {
          console.log('Could not send user welcome email ', err);
        }

        console.log('Welcome email sent to ' + user.id);
      });

      req.login(user, function (err) {
        if (err) {
          return res.redirect('back');
        }
        return res.redirect('/auth/account');
      });
    });
  });

  app.get('/auth/logout', function (req, res, next) {
    req.logout();
    res.send(200);
  });

  app.get('/redirect/facebook-splash', function(req, res, next){
    var data = {
      accessToken: req.query.access_token,
      userId: req.query.userId
    };

    res.render('facebook-splash', data);
  });
}
