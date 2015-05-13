module.exports = function (Brand) {

  Brand.autoComplete = function autoComplete(query, cb) {
    //Search for brands given the input - not case sensitive
    Brand.find({where: {name: new RegExp(query, 'i'), deleted: false}}, function (err, brands) {
      cb(err, brands);
    });
  };

  Brand.remoteMethod(
    'autoComplete',
    {
      http: {path: '/autocomplete', verb: 'get'},
      accepts: {arg: 'query', type: 'string'},
      returns: {type: 'array', root: true}
    }
  );

  Brand.observe('before save', function(ctx, next) {
    var data = ctx.instance || ctx.data;
    data.updatedAt = new Date();

    next();
  });
};
