module.exports = function(Cart) {
  var _ = require('lodash');
  var ObjectID = require('mongodb').ObjectID;

  Cart.addIdToMealReferences = function addIdToMealReferences(mealReferences) {
    mealReferences.forEach(function(mealReference) {
      if (!mealReference.id) {
        mealReference.id = new ObjectID();
      }
    });
  };

  Cart.observe('before save', function(ctx, next) {
    var Meal = Cart.app.models.Meal;
    var data = ctx.instance || ctx.data;

    if (!data._mealReferences.length) {
      return next();
    }

    Cart.addIdToMealReferences(data._mealReferences);
    var mealIds = _.pluck(data._mealReferences, 'mealId');
    Meal.find({where: {id: {inq: mealIds}, active: false}}, function(err, meals) {
      if (err) {
        return next(err);
      }

      if (meals.length) {
        var invalidMealNames = _.pluck(meals, 'name');
        return next(new Error('Error saving cart. Following meals are not available: ' + invalidMealNames.join(', ')));
      }

      return next();
    });
  });
};
