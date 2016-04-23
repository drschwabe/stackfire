var async = require('async'), 
    _ = require('underscore')

var ar = { routes : [] }

ar.listen = function(param1, callback) {
  //param1: a string or an array of strings.

  var that = this
  var registerRoute = function(route, callback) {
    //Determine if the route already exists:
    if(!_.findWhere(that.routes, { path: route })) {

      //Make an entry for it; add to known routes and define middleware array...
      that.routes.push({ path: route, middleware: [callback]})  

    } else {
      //If the route already exists, just push this module's callback 
      //into the  middleware array; stack: 
      _.findWhere(that.routes, { path: route }).middleware.push(callback)
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

ar.fire = function(route, state, callback) {

  var matchingRoute = _.findWhere(this.routes, { path: route })
  //TODO: implement more robust Express regex style route matching.
  if(matchingRoute) {
    //Give the waterfall a seed function with current state: 
    matchingRoute.middleware.unshift(function(next) { next(null, state) })
    async.waterfall(matchingRoute.middleware, function(err, state) {
      if(err) return console.log(err)
      callback(null, state)
    })
  } else {
    console.log('no matching routes found.')
  }
}

module.exports = ar
