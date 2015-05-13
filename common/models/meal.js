var loopback = require('loopback');
var ObjectID = require('mongodb').ObjectID;

module.exports = function(Meal) {
  var moment = require('moment');
  var _ = require('lodash');
  var async = require('async');
  var ShuffleBag = require('../ShuffleBag');

  var EXPERT_FEE = (15/100); //15 Percent

  Meal.calculateTotal = function calculateTotal(meal) {
    var total = 0;
    meal._dishes.forEach(function(dish) {
      if (dish.sizes && dish.sizes.length) {
        total += parseFloat(_.result(_.findWhere(dish.sizes, {selected: true}), 'price'));
      } else {
        total += parseFloat(dish.price);
      }

      dish.options.forEach(function(option) {
        if (option.selected !== true) {
          return;
        }

        total += _.sum(_.pluck(_.where(option.choices, {selected: true }), 'price'));
      });
    });

    return parseFloat(total.toFixed(2));
  };

  Meal.calculateExpertPrice = function(price) {
    var expertPrice = price + (price * EXPERT_FEE);
    var decimal = expertPrice % 1;
    if (decimal <= 0.25) {
      expertPrice = expertPrice + (0.25 - decimal);
    } else if (decimal <= 0.50) {
      expertPrice = expertPrice + (0.50 - decimal);
    } else if (decimal <= 0.75) {
      expertPrice = expertPrice + (0.75 - decimal);
    } else {
      expertPrice = expertPrice + (1 - decimal);
    }

    return parseFloat(expertPrice.toFixed(2))
  };

  Meal.validateOptions = function(meal) {
    var dish;
    var option;
    var selectedChoices;

    for (var dishIndex in meal._dishes) {
      dish = meal._dishes[dishIndex];
      if (dish.sizes && dish.sizes.length) {
        if(!_.some(dish.sizes, {selected: true})) {
          return false;
        }
      }

      for (optionIndex in dish.options) {
        option = dish.options[optionIndex];
        selectedChoices = _.where(option.choices, {selected: true});
        if (selectedChoices.length < option.minSelection || selectedChoices.length > option.maxSelection) {
          return false;
        }
      }
    }

    return true;
  };

  Meal.validateMinimum = function validateMinimum(meal, cb) {
    var Brand = Meal.app.models.Brand;
    var valid = false;
    Brand.findById(meal.brandId, function(err, brand) {
      if (err) {
        return cb(err);
      }

      if (parseFloat(meal.price) >= parseFloat(brand.minimum)) {
        valid = true;
      }

      return cb(null, valid);
    });
  };


  Meal.autoComplete = function autoComplete(query, cb) {
    //Search for tags given the input - not case sensitive
    Meal.find({where: {name: new RegExp(query, 'i')}, include: ['brand']}, function (err, meals) {
      meals.forEach(function(meal) {
        meal.brand(function(err, brand) {
          if (err) {
            return cb(err);
          }

          meal.brandName = brand.name;
        });
      })
      return cb(err, meals);
    });
  };

  Meal.remoteMethod(
    'autoComplete',
    {
      http: {path: '/autocomplete', verb: 'get'},
      accepts: {arg: 'query', type: 'string'},
      returns: {type: 'array', root: true}
    }
  );

  Meal.getRandomList = function(meals, listSize) {
    listSize = listSize || 7;
    var brandMealCount = {};
    var randomList = [];
    var shuffleBag = new ShuffleBag();
    meals.forEach(function(meal) {
      shuffleBag.add(meal);
    });

    var meal;
    while ((meal = shuffleBag.next()) && randomList.length < listSize) {
      brandMealCount[meal.brandId] = brandMealCount[meal.brandId] || 0;
      if (brandMealCount[meal.brandId] < 2) {
        randomList.push(meal);
        brandMealCount[meal.brandId]++;
      }
    }

    return randomList;
  };

  //690 Greenwich St, New York, NY 10014, USA
  //Latitude: 40.733097 | Longitude: -74.007599
  Meal.geoSearch = function geoSearch(googlePlaceId, userFilters, cb) {
    var GooglePlace = Meal.app.models.GooglePlace;
    var Delivery = Meal.app.models.Delivery;
    var Brand = Meal.app.models.Brand;

    var ctx = loopback.getCurrentContext();
    var currentUser = ctx && ctx.get('currentUser');

    userFilters = userFilters || [];

    if (!Array.isArray(userFilters)){
      userFilters = [userFilters];
    }
    
    if (userFilters.length) {
      userFilters = userFilters.map(function(userFilter){
        if (typeof userFilter === "string") {
          userFilter = JSON.parse(userFilter);
        }
        if (typeof userFilter.nutritionTagId === "string") {
          userFilter.nutritionTagId = new ObjectID(userFilter.nutritionTagId);
        }
        return userFilter;
      });
    } else if(currentUser) {
      userFilters = currentUser._nutritionTagReferences;
    }

    userFilters = _.pluck(userFilters, 'nutritionTagId');

    GooglePlace.findOne(googlePlaceId, function(err, place) {
      if (err || (!place || !place.address || !place.address.formatted)) {
        var error = err || new Error('Formatted address must be present');
        return cb(error);
      }

      var address = place.address.formatted;
      address = address.substring(address.lastIndexOf(","), -1);
      Delivery.restaurantSearch(address, function(err, restaurants) {
        if (err) {
          return cb(err);
        }

        var brandExternalIds = _.map(restaurants, function(restaurant) {
          return restaurant.src.externalId;
        });

        Brand.find({
          where: {'src.externalId': {inq: brandExternalIds}}
        }, function(err, brands) {
          if (err) {
            return cb(err);
          }

          brands = brands || [];
          if (!brands.length) {
            return cb(
              null,
              {data: [], message: "We haven't made it to your hood yet. Stay tuned, we are coming soon :)"}
            );
          }

          var now = moment();
          var militaryTime = parseInt(now.format('Hmm'));
          var day = now.format("dddd").toLowerCase();
          var brandIds = _.pluck(brands, 'id');
          var where = {
            brandId: {inq: brandIds},
            active: true,
            'schedule.day': day,
            'schedule.from': {lt: militaryTime},
            'schedule.to': {gt: militaryTime}
          };

          if (userFilters && userFilters.length) {
            where['_nutritionTagReferences.nutritionTagId'] = {all: userFilters};
          }

          Meal.find({
            where: where,
            include: [
              'brand',
              {relation: 'trainerReference', scope: {include: 'trainer'}},
              {relation: 'nutritionTagReferences', scope: {include: 'nutritionTag'}}
            ],
            order: 'brandId DESC, id DESC'
          }, function(err, meals) {
            if (err) {
              return cb(err);
            }

            meals = meals || [];
            if (!meals.length) {
              return cb(
                null,
                {data: [], message: "Yikes, there are currently no dishes that match your filters. While we scurry around trying to get more online, adjust your filters for more options :)"}
              );
            }

            return cb(null, {data: Meal.getRandomList(meals)});
          });
        });

      });
    });
  };

  Meal.remoteMethod(
    'geoSearch',
    {
      http: {path: '/geoSearch', verb: 'get'},
      accepts: [
        {arg: 'googlePlaceId', type: 'string'},
        {arg: 'userFilters', type: 'array'}
      ],
      returns: {type: 'object', root: true}
    }
  );


  Meal.addIdToDishes = function addIdToDishes(meal) {
    meal._dishes.forEach(function(dish) {
      dish.id = new ObjectID();
      dish.updatedAt = new Date();
    });
  }

  Meal.addIdToTags = function addIdToTags(meal) {
    meal._nutritionTagReferences.forEach(function(nutritionTag) {
      nutritionTag.id = new ObjectID();
    });
  }

  Meal.observe('before save', function(ctx, next) {
    var data = ctx.instance || ctx.data;

    if (data._dependencies && !data.brandId) {
      Meal.saveDependencies(data._dependencies, function(err, deps) {
        data.brandId = deps.brandId;
        data.unsetAttribute('_dependencies');
        data.unsetAttribute('brand');
        data.unsetAttribute('trainer');
        Meal.addIdToDishes(data);
        Meal.addIdToTags(data);

        var price = Meal.calculateTotal(data.toJSON());
        data.setAttribute('price', price);
        data.setAttribute('expertPrice', Meal.calculateExpertPrice(price));
        validate(data.toJSON());
      });
    } else {
      delete data._dependencies;
      delete data.brand;
      delete data.trainer;
      Meal.addIdToDishes(data);
      Meal.addIdToTags(data);

      var price = Meal.calculateTotal(data);
      data.price = price;
      data.expertPrice = Meal.calculateExpertPrice(price);
      validate(data);
    }

    function validate(meal) {
      if (!Meal.validateOptions(meal)) {
        return next(new Error('Invalid dish please set the size and choices for all options'));
      }

      Meal.validateMinimum(meal, function(err, valid) {
        if (err || !valid) {
          var error = err || new Error('Meal price $' + meal.price + ' does not meet the restaurant minimum');
          return next(error);
        }

        return next();
      });
    }
  });

  Meal.saveDependencies = function(data, cb) {
    var Brand = Meal.app.models.Brand;
    Brand.findOne({where: {'src.externalId': data.brand.src.externalId}}, function(err, brand) {
      if (err) {
        return cb(err);
      }

      if (brand && brand.id) {
        data.brandId = brand.id;
        return cb(null, data);
      }

      Brand.create(data.brand, function(err, brand){
        if (err) {
          return cb(err);
        }

        data.brandId = brand.id;
        return cb(null, data);
      });
    });
  };

  Meal.remoteMethod(
    'saveDependencies',
    {
      http: {path: '/saveDependencies', verb: 'post'},
      accepts: {arg: 'data', type: 'object'},
      returns: {type: 'object', root: true}
    }
  );

  Meal.getMealSchedule = function getMealSchedule(schedules) {
    var mealSchedules = [];
    schedules.forEach(function(schedule) {
      var matched = [];
      matched = _.filter(mealSchedules, function(mealSchedule) {
          return schedule.day === mealSchedule.day;
      });

      if (!matched.length) {
        mealSchedules.push(schedule);
      }

      var scheduleMatch = false;
      matched.some(function(match) {
        if (match.to < schedule.from) {
          scheduleMatch = true;
          return false;
        }

        scheduleMatch = false;
        if (schedule.from > match.from) {
          match.from = schedule.from;
        }

        if (schedule.to < match.to) {
          match.to = schedule.to;
        }

        return true;
      });

      if (scheduleMatch) {
        mealSchedules.push(schedule);
      }
    });

    return mealSchedules;
  };
};
