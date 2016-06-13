var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser')

var ar = { routes : [] }

ar.listen = function(param1, callback) {
  //param1: a string or an array of strings.

  var that = this
  var registerRoute = function(path, callback) {

    var route = routeParser(path)
    var existingRoute = _.find(that.routes, function(existingRoute) {
      return existingRoute.route.spec == route.spec
    })

    //Determine if the route already exists:
    if(!existingRoute) {
      //Make an entry for it; add to known routes and define middleware array/stack:
      that.routes.push({ route: route, middleware: [callback]})  
    } else {
      //If the route already exists, just push this module's callback 
      //into the middleware array/stack: 
      existingRoute.middleware.push(callback)
    }      
  }

  //Parse first paramater: 
  //(is either a single route or array of routes)
  if(_.isArray(param1)) {
    param1.forEach(function(path) {
      registerRoute(path, callback)
    })
  } else {
    registerRoute(param1, callback)
  }
}

ar.fire = function(path, state, callback) {

  var matchingRoute, req
  matchingRoute = _.find(this.routes, function(route) {
    var result = route.route.match(path)
    if(result) {
      req = result
    } else {
      req = {} //<If there was no matching route, create an obj anyway.       
    }
    req.path = path
    //^ Parses the route; organizing params into a tidy object.
    return result
  })

  var that = this

  //Apply req as a property of state. 
  state.req = req

  async.series([
    function(seriesCallback) {
      //Fire any middleware (route agnostic)...
      if(that.middleware) { //Seed it with the req and state:   
        that.middleware[0] = function(next) { next(null, state) }
        //Run the middleware stack: 
        async.waterfall(that.middleware, function(err, state) {
          if(err) return console.log(err)
          seriesCallback(null)
        })
      } else {
        seriesCallback(null)
      }
    }, 
    function(seriesCallback) {
      var seedFunction = function(next) { next(null, state) }
      if(matchingRoute) {
        //Give the waterfall a seed function with null error, parsed/matched route (req), and state: 
        if(!matchingRoute.seeded) { //but only if we haven't already done it: 
          matchingRoute.middleware.unshift(seedFunction)      
          matchingRoute.seeded = true      
        } else { //If already seeded, we overwrite the original seed function
          //(because req and state may have changed): 
          matchingRoute.middleware[0] = seedFunction
        }

        async.waterfall(matchingRoute.middleware, function(err, state) {
          if(err) return console.log(err)
          if(_.isFunction(callback)) callback(null, state)
        })
      } else {
        //(no matching routes found)
        if(_.isFunction(callback)) callback(null, state)
      }
    }
  ])
}

ar.use = function(callback) {
  //Apply the function to a separate middleware property which 
  //will be called on every fire.
  if(!this.middleware) this.middleware = [null]
  //Set a null placeholder into the [0] position of the array, 
  //this is replaced by a seed function when ar.fire is called.
  this.middleware.push(callback)
  //^ push the callback to the stack.
}

module.exports = ar
