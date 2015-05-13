module.exports = function(Order) {
  var _ = require('lodash');
  var stripe = require('../stripe');
  var ObjectID = require('mongodb').ObjectID;

  Order.status = {
    PENDING: "pending",
    READY: "ready",
    PROCESSING: "processing",
    COMPLETE: "complete",
    CANCELLED: "cancelled",
    FAILED: "failed"
  };

  Order.charge = function charge(orderId, cardId, cb) {
    Order.findOne({
      where: { id: orderId },
      include: [
        'user',
        {
          relation: 'mealReferences',
          scope: {
            include: {relation: 'meal', scope: {include: 'brand'}}
          }
        }
      ]
    }, function(err, order){
      if (!err && !order) {
        err = new Error("Order does not exist");
      }

      if (err) {
        return cb(err);
      }

      stripe.charges.create({
        amount: parseInt(order.cost.subTotal * 100), // stripe charges in cents
        currency: "usd",
        customer: order.user().payment.customerId,
        source: cardId
      }, function(err, charge){
        var updateData = {};

        if (err) {
          return cb(err);
        }

        updateData.payment = {
          transactionId: charge.id,
          status: stripe.statusMap[charge.status]
        };

        if (updateData.payment.status === 'paid') {
          updateData.status = "ready";
        }

        order.updateAttributes(updateData, function(err, _order){
          if (err) {
            return cb(err);
          }
          cb(err, order);
        });
      });

    });
  }

  Order.remoteMethod('charge', {
    http: {path: '/charge', verb: 'post'},
    accepts: [
      {arg: 'orderId', type: 'string'},
      {arg: 'cardId', type: 'string'}
    ],
    returns: {type: 'object', root: true}
  });

  Order.calculateTotals = function(mealReferences, meals) {
    var totals = {baseTotal: 0, subTotal: 0};
    meals.forEach(function(meal) {
      var quantity = _.result(_.findWhere(mealReferences, {mealId: meal.id}), 'quantity');
      totals.subTotal += meal.expertPrice * quantity;
      totals.baseTotal += meal.price * quantity;
    });

    return totals;
  };

  Order.calculateTax = function(baseTotal) {
    return parseFloat((baseTotal*(8.875/100)).toFixed(2)); //tax 8.875percent
  };

  Order.calculateTip = function(baseTotal) {
    return parseFloat((baseTotal*(15/100)).toFixed(2)); //tip 15percent
  };

  Order.setCost = function(order, cb) {
    var Meal = Order.app.models.Meal;
    var mealIds = _.pluck(order._mealReferences, 'mealId');

    Meal.find({where: {id: {inq: mealIds}}}, function(err, meals) {
      if (err) {
        return cb(err);
      }

      var totals = Order.calculateTotals(order._mealReferences, meals);
      order.cost = {};
      order.cost.subTotal = totals.subTotal;
      order.cost.baseTotal = totals.baseTotal;
      order.cost.tax = Order.calculateTax(totals.baseTotal);
      order.cost.tip = Order.calculateTip(totals.baseTotal);
      order.cost.total = parseFloat((totals.subTotal + order.cost.tax + order.cost.tip).toFixed(2));

      return cb();
    });
  };

  Order.addIdToMeals = function addIdToMeals(order) {
    order._mealReferences.forEach(function(meal) {
      if (meal.id) {
        return;
      }
      meal.id = new ObjectID();
    });
  }

  Order.observe('before save', function(ctx, next) {
    var order = ctx.data || ctx.instance.toJSON();

    if (!order._mealReferences) {
      return next();
    }

    Order.addIdToMeals(order);

    Order.setCost(order, function(err) {
      if (err) {
        return next(err);
      }

      if (ctx.instance) {
        ctx.instance.setAttribute('_mealReferences', order._mealReferences);
        ctx.instance.setAttribute('cost', order.cost);
      }

      return next();
    });

  });

};
