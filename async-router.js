var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser')

var ar = { routes : [] }

ar.listen = function(param1, callback) {
  //param1: a string or an array of strings.
  //(is either a single path or array of paths)  

  var that = this
  var registerRoute = function(path, listenerCallback) {

    var route = routeParser(trimSigFromPath(path))
    var existingRoute = _.find(that.routes, function(existingRoute) {
      return existingRoute.route.spec == route.spec
    })

    //The newMiddleware contains two properties; one is the callback
    //the other is the full path (containing sig) so we can later target/override this. 
    var newMiddleware = { func : listenerCallback, path: path }    

    //Determine if the route already exists:
    if(!existingRoute) {
      var route = { route: route, middleware: [newMiddleware] }
      //Make an entry for it; add to known routes and define middleware array/stack:
      that.routes.push(route)  
    } else {
      //If the route already exists, just push the new middleware into the 
      //existing stack: 
      existingRoute.middleware.push(newMiddleware)
    }      
  }

  //If an array was not supplied, create an array anyway: 
  var paths
  if(!_.isArray(param1)) paths = [param1]
  else paths = param1

  paths.forEach(function(path) {
    //Check for signature: 
    if(path.charAt(0) == '@') {
      //Register it with two padding functions that set and clear the signature
      //on the state object.  
      registerRoute(path, function(state, next) {
        state.sig = snipSignature(param1) //< Stamps signature.
        next(null, state)
      })
      //The actual function: 
      registerRoute(path, callback)
      //Clear the signature: 
      registerRoute(path, function(state, next) {
        delete state.sig
        next(null, state)        
      })
    } else {
      registerRoute(path, callback)
    }
  })
}

ar.fire = function(path, state, callback) {

  //Check for signature: 
  if(path.charAt(0) == '@') {
    state.sig = snipSignature(path) //< Apply to state obj.
    path = trimSigFromPath(path) //Trim from actual command path.
  }

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
      if(that.middleware) { 
        //Seed it with the req and state:   
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
          matchingRoute.middleware.unshift({func: seedFunction })      
          matchingRoute.seeded = true      
        } else { //If already seeded, we overwrite the original seed function
          //(because req and state may have changed): 
          matchingRoute.middleware.func = seedFunction
        }

        //Create a copy of the middleware stack we are about to run
        //containing only the functions
        //(preparing the data structure for what async.waterfall will expect): 
        var middlewareToRun = _.map(matchingRoute.middleware, function(entry) { return entry.func })

        async.waterfall(middlewareToRun, function(err, state) {
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

ar.disable = function(path) {
  //Disable the supplied command based on it's unique path.
  //Expecting @name-of-module/actual-command-path
  var targetRoute = _.find(this.routes, function(route) { return route.route.spec == trimSigFromPath(path) })
  var targetListeners = _.filter(targetRoute.middleware, function(listener) { return listener.path == path })
  targetRoute.middleware = _.difference(targetRoute.middleware, targetListeners)
}

//Helper functions: 
var snipSignature = function(path) {
  //Expected pattern is: @name-of-module/actual/route
  return path.split('/')[0]
}

var trimSigFromPath = function(path) {
  return '/' + _.without(path.split('/'), path.split('/')[0]).join('/')
}


module.exports = ar
