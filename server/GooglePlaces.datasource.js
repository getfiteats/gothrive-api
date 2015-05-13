module.exports = {
  'name': 'GooglePlaces',
  'connector': 'rest',
  'debug': true,
  'operations': [
    {
      'template': {
        'method': 'GET',
        'url': 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        'query': {
          'key': process.env.GOOGLE_PLACES_API_KEY,
          'input': '{input}'
        },
        'responsePath': '$.predictions[0]'
      },
      'functions': {
        'autocomplete': [
          'input'
        ]
      }
    },
    {
      'template': {
        'method': 'GET',
        'url': 'https://maps.googleapis.com/maps/api/place/details/json',
        'query': {
          'key': process.env.GOOGLE_PLACES_API_KEY,
          'placeid': '{placeId}'
        },
        'responsePath': '$.result'
      },
      'functions': {
        'details': [
          'placeId'
        ]
      }
    }
  ]
};
