var _ = require('lodash');
var path = require('path');
var app = require(path.resolve(__dirname, '../server'));
var Brand = app.models.Brand;
var Meal = app.models.Meal;
var Delivery = app.models.Delivery;


Brand.find({where: {deleted: false}}, function(err, brands) {
  if (err) {
    throw err;
  }

  brands.forEach(function(brand) {
      Delivery.getDishesByRestaurantId(brand.src.externalId, function(err, dishes) {
        if (err) {
          throw err;
        }

        Meal.find({where: {brandId: brand.id, active: true}}, function(err, meals) {
          if (err) {
            throw err;
          }

          meals.forEach(function(meal) {
            var dishSchedules = [];
            meal._dishes.forEach(function(dish) {
              var schedule = _.result(_.find(dishes, function(d) {
                return d.src.externalId === dish.src.externalId;
              }), 'schedule');
              dishSchedules = dishSchedules.concat(schedule);
            });
            meal.schedule = Meal.getMealSchedule(dishSchedules);
            var updatedMeal = new Meal(meal);
            delete meal.id;
            updatedMeal.updateAttributes(meal, function(err, savedMeal) {
              if (err) {
                throw err;
              }

              console.log('Successfully updated meal schedule: ' + savedMeal.name + ' ' + savedMeal.id);
            });

          });
        });
      })
  });
});
