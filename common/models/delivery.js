module.exports = function(Delivery) {
  var moment = require('moment');

  Delivery.getDishesByRestaurantId = function getDishesByRestaurantId(restaurantId, cb) {

    function getDishesFromMenuSection(menuSection, menuSchedule) {
      var Dish = Delivery.app.models.Dish;
      var dishes = [];
      menuSection.children.forEach(function(item) {
        var dish = new Dish();
        dish.section = menuSection.name,
          dish.name = item.name;
        dish.src = {
          "name": "delivery",
          "externalId": item.id
        };
        dish.price = item.price;
        dish.options = [];
        dish.sizes = [];
        dish.schedule = menuSchedule;

        item.children.forEach(function(optionGroup) {
          switch (optionGroup.type) {
            case 'price group':
              dish.sizes = formatDishSizes(optionGroup);
              break;
            case 'option group':
              dish.options.push(formatDishOptions(optionGroup));
              break;
          }
        });

        dishes.push(dish);
      });

      return dishes;
    }

    function getSchedule(menu) {
      var schedules = {};
      menu.schedule.forEach(function(schedule) {
        var times = [];
        schedule.times.forEach(function(time) {
          var formattedSchedule = {};
          formattedSchedule.day = time.day.toLowerCase();
          formattedSchedule.from = parseInt(moment(time.from).format('Hmm'));
          formattedSchedule.to = parseInt(moment(time.to).format('Hmm'));
          times.push(formattedSchedule);
        });

        schedules[schedule.id] = times;
      });

      return schedules;
    }

    function getMenuSchedule(scheduleIds, schedules) {
      scheduleIds = scheduleIds || [];
      if (!scheduleIds.length) {
        return [
          {day: 'sunday', from: 0, to: 2400},
          {day: 'monday', from: 0, to: 2400},
          {day: 'tuesday', from: 0, to: 2400},
          {day: 'wednesday', from: 0, to: 2400},
          {day: 'thursday', from: 0, to: 2400},
          {day: 'friday', from: 0, to: 2400},
          {day: 'saturday', from: 0, to: 2400}
        ];
      }

      var menuSchedule = [];
      scheduleIds.forEach(function(id) {
        menuSchedule = menuSchedule.concat(schedules[id]);
      });

      return menuSchedule;
    }

    Delivery.restaurantMenu(restaurantId, function(err, restaurantMenu) {
      if (err || !restaurantMenu || !restaurantMenu.menu) {
        var error = err || new Error('Could not retrieve menu');
        return cb(error);
      }

      var schedules = getSchedule(restaurantMenu);
      var dishes = [];
      restaurantMenu.menu.forEach(function(menu) {
        if (menu.children[0].type === 'item') {
          var menuSchedule = getMenuSchedule(menu.schedule, schedules);
          dishes = dishes.concat(getDishesFromMenuSection(menu, menuSchedule));
        } else if (menu.children[0].type === 'menu') {
          menu.children.forEach(function(menuSection) {
            var scheduleIds = menuSection.schedule || menu.schedule;
            var menuSchedule = getMenuSchedule(scheduleIds, schedules);
            dishes = dishes.concat(getDishesFromMenuSection(menuSection, menuSchedule));
          });
        }
      });

      return cb(null, dishes);
    });
  };

  Delivery.remoteMethod(
    'getDishesByRestaurantId',
    {
      http: {path: '/restaurantDishes', verb: 'get'},
      accepts: {arg: 'restaurantId', type: 'string'},
      returns: {type: 'array', root: true}
    }
  );

  Delivery.restaurantSearch = function restaurantSearch(address, cb) {
    var RESTAURANT_MERCHANT_TYPE = 'R';
    Delivery.merchantSearch(address, RESTAURANT_MERCHANT_TYPE, function(err, restaurants) {
      if (err || !restaurants || !restaurants.merchants) {
        var error = err || new Error('Could not retrieve restaurants');
        return cb(error);
      }

      var brands = [];
      restaurants.merchants.forEach(function(restaurant) {
        if (restaurant.ordering.payment_types.indexOf('credit') === -1) {
          return;
        }

        brands.push({
          name: restaurant.summary.name,
          cuisines: formatRestaurantCuisines(restaurant.summary.cuisines),
          summary: restaurant.summary.description,
          phone: restaurant.summary.phone,
          address: {
            street: restaurant.location.street,
            city: restaurant.location.city,
            state: restaurant.location.state,
            zip: restaurant.location.zip
          },
          minimum: restaurant.ordering.minimum,
          src: {
            name: "delivery",
            externalId: restaurant.id
          },
          geo: {
            type: "Point",
            coordinates: [restaurant.location.longitude, restaurant.location.latitude]
          }
        });
      });

      return cb(null, brands);
    });
  };

  Delivery.remoteMethod(
    'restaurantSearch',
    {
      http: {path: '/restaurantSearch', verb: 'get'},
      accepts: {arg: 'address', type: 'string'},
      returns: {type: 'array', root: true}
    }
  );

  function formatRestaurantCuisines(cuisines) {
    if (!cuisines) {
      return [];
    }

    var formattedCuisines = [];
    cuisines.forEach(function(cuisine) {
      formattedCuisines.push(cuisine.toLowerCase());
    });

    return formattedCuisines;
  }

  function formatDishSizes(sizes) {
    var formattedSizes = [];
    sizes.children.forEach(function(size) {
      formattedSizes.push({
        id: size.id,
        name: size.name,
        price: size.price,
        selected: false
      });
    });

    return formattedSizes;
  }

  function formatDishOptions(option) {
    var formattedOptions = {
      id: option.id,
      name: option.name,
      minSelection: option.min_selection,
      maxSelection: option.max_selection,
      selected: false,
      choices: []
    };

    option.children.forEach(function(choice) {
      formattedOptions.choices.push({
        id: choice.id,
        name: choice.name,
        price: choice.price,
        selected: false
      });
    });

    return formattedOptions;
  }
};
