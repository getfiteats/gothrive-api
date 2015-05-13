//TODO: Figure out why test users are not getting deleted and why the test is failing

//var lt = require('loopback-testing');
//var assert = require('assert');
//var app = require('../../../server/server.js'); //path to app.js or server.js
//
//var testUser = {email: 'test@test.com', password: 'test'};
//
//describe('/brands/autocomplete', function() {
//  lt.beforeEach.withApp(app);
//  lt.describe.whenCalledByUserWithRole(
//    testUser,
//    'admin',
//    'GET',
//    '/api/brands',
//    function() {
//      lt.it.shouldBeAllowed();
//      it('should have statusCode 200', function() {
//        console.log('tokennnnn', JSON.stringify(this));
//        assert.equal(this.res.statusCode, 200);
//      });
//
//      //lt.beforeEach.givenModel('brand', {name: 'TestBrandName'});
//      //it('should respond with an array of brands', function() {
//      //  //this.app.models.Brand.find(function(err, brands) {
//      //  //  console.log(brands);
//      //  //});
//      //
//      //  //console.log('bodyyyyy', this.res.body);
//      //  assert(Array.isArray(this.res.body));
//      //});
//  });
//});
