var path = require('path');
var app = require(path.resolve(__dirname, '../server'));
var Order = app.models.Order;
var Delivery = app.models.Delivery;
var DeliveryOrder = require(path.resolve(__dirname, '../../common/DeliveryOrder'))(Order, Delivery);
var OrderWorker = require(path.resolve(__dirname, '../../common/OrderWorker'))(Order, Delivery, DeliveryOrder);

new OrderWorker().twerk();
