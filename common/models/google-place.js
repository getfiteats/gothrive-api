module.exports = function(GooglePlace) {

  GooglePlace.formatAddress = function(place) {
    var addressParts = place.formatted_address.split(',');
    var address;
    try {
      address = {
        street: addressParts[0].trim(),
        city: addressParts[1].trim(),
        state: addressParts[2].trim().split(' ')[0],
        zip: addressParts[2].trim().split(' ')[1],
        country: addressParts[3].trim(),
        formatted: place.formatted_address
      };
    } catch(err) {}

    return address;
  };

  GooglePlace.findOne = function findOne(placeId, cb) {
    var Brand = GooglePlace.app.models.Brand;
    GooglePlace.details(placeId, function(err, place) {
      if (err) {
        return cb(err);
      }
      try {
        place = place[0];

        var brand = new Brand();
        brand.name = place.name;
        brand.phone =  place.formatted_phone_number && place.formatted_phone_number.replace(/[()-]| /g,'');
        brand.address = GooglePlace.formatAddress(place);
        brand.src = {
          name: "googleplace",
          externalId: place.place_id
        };
        brand.geo = {
          type: "Point",
          coordinates: [place.geometry.location.lng, place.geometry.location.lat]
        };

        brand.schedule = [];
        place.opening_hours.periods.forEach(function(period) {
          brand.schedule.push({day: period.open.day, startTime: period.open.time, endTime: period.close.time});
        });
      } catch(err) {
      }

      return cb(null, brand);
    });
  };

  GooglePlace.remoteMethod(
    'findOne',
    {
      http: {path: '/:id', verb: 'get'},
      accepts: {arg: 'id', type: 'string'},
      returns: {type: 'object', root: true}
    }
  );

};
