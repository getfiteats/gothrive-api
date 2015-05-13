var Random = require("random-js");
var moment = require('moment');

module.exports = function () {
  var data = [], cursor = -1;
  var today = moment(moment().format("MM-DD-YYYY"), "MM-DD-YYYY").valueOf();
  var random = new Random(Random.engines.mt19937().seed(today));
  return {
    add: function (item, num) {
      var i = num || 1;
      while (i--) {
        data.push(item);
      }
      cursor = data.length - 1;
    },
    next: function () {
      var grab, temp;
      if (cursor === -1) {
        return null;
      }
      if (cursor < 1) {
        cursor--;
        return data[0];
      }
      //grab = Math.floor(Math.random() * (cursor + 1));
      grab = random.integer(0, cursor);
      temp = data[grab];
      data[grab] = data[cursor];
      data[cursor] = temp;
      cursor--;
      return temp;
    }
  };
};
