module.exports = function(NutritionTag) {
  NutritionTag.autoComplete = function autoComplete(query, cb) {
    //Search for tags given the input - not case sensitive
    NutritionTag.find({where: {name: new RegExp(query, 'i')}}, function (err, tags) {
      cb(err, tags);
    });
  };

  NutritionTag.remoteMethod(
    'autoComplete',
    {
      http: {path: '/autocomplete', verb: 'get'},
      accepts: {arg: 'query', type: 'string'},
      returns: {type: 'array', root: true}
    }
  );
};
