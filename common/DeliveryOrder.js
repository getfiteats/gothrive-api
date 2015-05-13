module.exports = function (Order, Delivery) {
  var async = require('async');
  var _ = require('lodash');

  function DeliveryOrder(order) {
    this.order = order;
  }

  DeliveryOrder.prototype.send = function send(cb) {
    this.delivery = toDelivery(this.order);
    var restaurantTasks = [];
    var me = this;
    Object.keys(this.delivery.restaurants).forEach(function(restaurantId) {
      restaurantTasks.push(
        async.apply(process.bind(me), restaurantId)
      );
    });

    async.parallelLimit(
      restaurantTasks,
      1,
      function (err) {
        if (err) {
          //handle this error
          me.order.status = Order.status.FAILED;
          console.log('Something went wrong...', err);
          return cb(me.order);
        }

        console.log('Order completed');
        me.order.status = Order.status.COMPLETE;
        return cb(me.order);
      }
    );
  }

  function process(restaurantId, cb) {
    var me = this;
    var restaurant = this.delivery.restaurants[restaurantId];
    console.log('Order Start - RestId: ' + restaurantId);
    async.waterfall([
      async.apply(addLocation.bind(this), restaurantId),
      clearCart.bind(this),
      addItems.bind(this),
      //verifyCart,
      getCard.bind(this),
      checkout.bind(this)
    ], function (err, result) {
      if (err) {
        console.log('Order Failed - RestId: ' + restaurantId);
        logError(me.order.id, restaurantId, err);
        addFailureToOrder.call(me, restaurantId, {error: err.message, response: result});
        return cb(err);
      }

      console.log('Order Successful - RestId: ' + restaurantId);
      addSuccessToOrder.call(me, restaurantId, {response: result});
      return cb();
    });
  }

  function addLocation(restaurantId, cb) {
    var me = this;
    Delivery.addLocation(
      this.delivery.location.street,
      this.delivery.location.unit,
      this.delivery.location.city,
      this.delivery.location.state,
      this.delivery.location.zip,
      this.delivery.location.phone,
      function(err, location) {
        location = location && location.location;
        if (err || location && !location.location_id) {
          var error = err || new Error('Failed adding location to Delivery');
          return cb(error);
        }

        me.delivery.location.id = location.location_id;
        return cb(null, restaurantId);
      }
    );
  }

  function clearCart(restaurantId, cb) {
    Delivery.deleteCart(
      restaurantId,
      function(err, cart) {
        if (err || cart.item_count !== 0) {
          var error = err || new Error('Could not clear cart on Delivery');
          return cb(error);
        }

        return cb(null, restaurantId);
      }
    );
  }

  function addItems(restaurantId, cb) {
    var addItemCalls = [];
    this.delivery.restaurants[restaurantId].forEach(function(dish) {
      addItemCalls.push(async.apply(addItem, restaurantId, dish.item));
    });

    async.parallel(addItemCalls, function(err) {
      if (err) {
        return cb(err);
      }

      return cb(null, restaurantId);
    });
  }

  function addItem(restaurantId, item, cb) {
    Delivery.addCartItem(
      restaurantId,
      item,
      'delivery',
      null, //orderTime
      function(err, result) {
        if (err || result && result.message && result.message.length) {
          var error = err || new Error('Failed to add item to the cart');
          return cb(error);
        }

        if (typeof result !== 'object') {
          return cb(new Error('Something horribly went wrong while trying to add an item: ' + item.item_id ));
        }

        return cb();
      }
    );
  }

  function getCard(restaurantId, cb) {
    Delivery.getCreditCards(function(err, cards) {
      if (err || !cards.length) {
        var error = err || new Error('No credit card found');
        return cb(error);
      }

      return cb(null, restaurantId, cards[0]);
    });
  }

  function checkout(restaurantId, card, cb) {
    var tip = Order.calculateTip(this.delivery.totals[restaurantId]);
    Delivery.checkout(
      restaurantId,
      tip,
      this.delivery.location.id,
      this.order.instructions,
      'delivery', //order type
      null, //orderTime
      [{
        type: 'credit_card',
        id: card.cc_id
      }],
      function(err, result) {
        if (err || (result && !result.order_id)) {
          var error = err || new Error('Checkout Failed. Order: ' + this.order.id + ' Restaurant: ' + resturantId);
          return cb(error);
        }

        return cb(null, result);
      }
    );
  }

  function toDelivery(order) {
    var delivery = {};
    delivery.location = {
      street: order.address.street,
      unit: order.address.unit,
      city: order.address.city,
      state: order.address.state,
      zip: order.address.zip,
      phone: order.address.phone
    };
    delivery.instructions = order.instructions;
    delivery.restaurants = {};
    delivery.totals = {};

    order.mealReferences.forEach(function(mealReference) {
      var restaurantId = mealReference.meal.brand.src.externalId;
      delivery.restaurants[restaurantId] = delivery.restaurants[restaurantId] || [];
      delivery.totals[restaurantId] = delivery.totals[restaurantId] || 0;
      mealReference.meal._dishes.forEach(function(dish) {
        var deliveryDish = {};
        deliveryDish.restaurantId = restaurantId;
        deliveryDish.item = {
          item_id: dish.src.externalId,
          item_qty: parseInt(mealReference.quantity),
          option_qty: {},
          instructions: dish.instructions
        };

        for (var sizeIndex in dish.sizes) {
          if (dish.sizes[sizeIndex].selected !== true) {
            continue;
          }

          deliveryDish.item.option_qty[dish.sizes[sizeIndex].id] = parseInt(mealReference.quantity);
          break;
        }

        dish.options.forEach(function(option) {
          if (option.selected !== true) {
            return;
          }

          option.choices.forEach(function(choice) {
            if (choice.selected === true) {
              deliveryDish.item.option_qty[choice.id] = 1;
            }
          });
        });

        delivery.restaurants[restaurantId].push(deliveryDish);
      });

      delivery.totals[restaurantId] += mealReference.meal.price * parseInt(mealReference.quantity);
    });

    return delivery;
  }

  function logError(orderId, restaurantId, error) {
    console.log('OrderId: ' + orderId + ' RestId: ' + restaurantId, error);
  }

  function addFailureToOrder(restaurantId, data) {
    this.order.failure = this.order.failure || [];
    this.order.failure.push({
      externalId: restaurantId,
      data: data
    });
  }

  function addSuccessToOrder(restaurantId, data) {
    this.order.success = this.order.success || [];
    this.order.success.push({
      externalId: restaurantId,
      data: data
    });
  }

  return DeliveryOrder;
}


//TODO: Parse and handle delivery.com error messages
