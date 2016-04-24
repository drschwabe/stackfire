var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser')

var ar = { routes : [] }

ar.listen = function(param1, callback) {
  //param1: a string or an array of strings.

  var that = this
  var registerRoute = function(route, callback) {
  
    var route = routeParser(route)

    //Determine if the route already exists:
    if(!_.findWhere(that.routes, { route: route })) {

      //Make an entry for it; add to known routes and define middleware array...
      that.routes.push({ route: route, middleware: [callback]})  

    } else {
      //If the route already exists, just push this module's callback 
      //into the  middleware array; stack: 
      _.findWhere(that.routes, { route: route }).middleware.push(callback)
    }      
  }

  //Parse first paramater: 
  //(is either a single route or array of routes)
  if(_.isArray(param1)) {
    param1.forEach(function(route) {
      registerRoute(route, callback)
    })
  } else {
    registerRoute(param1, callback)
  }
}

ar.fire = function(path, state, callback) {

  var matchingRoute, req
  matchingRoute = _.find(this.routes, function(route) {
    req = route.route.match(path) 
    //^ Parses the route; organizing params into a tidy object.
    return req
  })

  if(matchingRoute) {
    //Give the waterfall a seed function with null error, parsed/matched route (req), and state: 
    matchingRoute.middleware.unshift(function(next) { next(null, req, state) })
    async.waterfall(matchingRoute.middleware, function(err, state) {
      if(err) return console.log(err)
      callback(null, state)
    })
  } else {
    console.log('no matching routes found.')
  }
}

module.exports = ar
