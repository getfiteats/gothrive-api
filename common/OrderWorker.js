module.exports = function (Order, Delivery, DeliveryOrder) {
  var path = require('path');
  var mail = require(path.resolve(__dirname, './mail'));
  var async = require('async');
  var _ = require('lodash');
  var MAX_RETRY = 5;
  var SLEEP_INTERVAL = 2;

  function OrderWorker() {
    this.retryCount = 0;
  }

  OrderWorker.prototype.twerk = function start() {
    var me = this;
    setTimeout(function() {
      processNext.call(me);
    }, 2000);
  }

  function processNext() {
    var me = this;
    async.waterfall([
      getNext.bind(this)
    ], function (err, order) {
      if (err) {
        logError.call(me, err);
        if (this.retryCount < MAX_RETRY) {
          this.retryCount++;
          return processNext();
        }
      }

      if (!order) {
        return me.twerk();
      }

      console.log('About to process order: ' + order.id);
      new DeliveryOrder(order.toJSON()).send(function(modifiedOrder) {
        mail.order(modifiedOrder.user, modifiedOrder, function(err) {
          if (err) {
            console.log("Could not send order email - " + modifiedOrder.id);
          }

          console.log("Order email send - " + modifiedOrder.id);
        });

        saveOrder(modifiedOrder, function(err, savedOrder) {
          return me.twerk();
        });
      });
    });
  }

  function getNext(cb) {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate()-1);

    var MongoConnector = Order.app.dataSources.mongodb.connector;

    MongoConnector.connect(function(err, db) {
      if (err) {
        logError(err);
        return cb(err);
      }

      db.collection(Order.modelName)
        .findOneAndUpdate(
        {createdAt: {$gt: yesterday}, status: Order.status.READY},
        {$set: {status: Order.status.PROCESSING}},
        {sort: [['createdAt','descending']]},
        function(err, order) {
          if (err) {
            return cb(err);
          }

          if (!order.value) {
            return cb();
          }

          order = order.value;
          Order.findOne({
            where: {id: order._id},
            include: [
              'user',
              {relation: 'mealReferences', scope: {include: {relation: 'meal', scope: {include: 'brand'}}}}
            ]
          }, function(err, hydratedOrder) {
            if (err) {
              return cb(err);
            }

            return cb(null, hydratedOrder);
          });
        });
    });
  }

  function saveOrder(order, cb) {
    var orderId = order.id;
    var updatedOrder = new Order(order);
    delete order.id;
    updatedOrder.updateAttributes(order, function(err, savedOrder) {
      if (err) {
        console.log('Failed to save modified order: ' + orderId, err);
        return cb(err);
      }

      console.log('Successfully saved the processed order: ' + orderId);
      return cb();
    });
  }

  function logError(err) {
    console.log('Error retrieving the next order: ' + err + ' RetryCount: ' + this.retryCount);
  }


  return OrderWorker;
}
