var path = require('path');
var app = require(path.resolve(__dirname, '../server'));
var Order = app.models.Order;
var mail = require(path.resolve(__dirname, '../../common/mail'));

  Order.findOne({
    where: {},
    include: [
      'user',
      {
        relation: 'mealReferences',
        scope: {
          include: {relation: 'meal', scope: {include: 'brand'}}
        }
      }
    ]
  }, function(err, order) {
    order = order.toJSON();
    mail.order(order.user, order, function(err) {
      if (err) {
        throw err;
      }

      console.log('order email sent');
    });
  });
