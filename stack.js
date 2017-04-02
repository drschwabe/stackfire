var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser')

var stack = { 
  routes : [], 
  state : {}, 
  command_queue : [], 
  next_queue : []
}

stack.on = function(param1, callback) {
  //param1: a string or an array of strings.
  //(is either a single path or array of paths)  

  var that = this
  var registerRoute = function(path, listenerCallback) {

    var route = new routeParser(path)
    var existingRoute = _.find(that.routes, function(existingRoute) {
      return existingRoute.route.match(path)      
    })    

    //The newMiddleware contains two properties; one is the callback
    //the other is the full path so we can later target/override this. 
    var newMiddleware = { func : listenerCallback, path: path }    

    //Determine if the route already exists:
    if(!existingRoute) {
      route = { route: route, middleware: [newMiddleware] }
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
    registerRoute(path, callback)
  })
}

stack.fire = function(path, param2, param3) {

  var state, callback
  //Parse the parameters to figure out what we got: 
  if(_.isFunction(param2)) { 
    callback = param2 //< param2 is the callback. 
    state = this.state //< state was not supplied, so we use the last known.
  }
  else if(_.isFunction(param3)) {
    callback = param3 //< param3 is the callback
    state = param2 //< param2 is assumed to be a fresh state obj
  }
  else if(_.isObject(param2)) {
    //Only a state object was supplied.
    callback = this.next_queue.pop()
    state = param2
  }
  else if(_.isUndefined(param2)) {
    //No params were supplied.
    callback = this.next_queue.pop()
    state = this.state //< TODO: use a pop() pattern like doing iwth next_queue    
  }

  //At this point if there is already a stack._command it means there is
  //a parent fire already in progress. 
  //So we store it so it can be applied after this particular fire completes. 
  if(state._command) stack.command_queue.push(state._command)

  var matchingRoute, command
  matchingRoute = _.find(this.routes, function(route) {
    var result = route.route.match(path)
    if(result) {
      command = result
    } else if(!result || _.isUndefined(result)) {
      command = {} //< If there was no matching route, create an obj anyway.       
    }
    command.path = path
    //^ Parses the route; organizing params into a tidy object.
    return result
  })

  var that = this

  //Apply command as a property of state. 
  state._command = command

  async.waterfall([
    function(seriesCallback) {
      //Fire any middleware (route agnostic)...
      if(that.middleware) { 
        //Seed it with the req and state:   
        that.middleware[0] = function(next) { next(null, state) }
        //Run the middleware stack: 
        async.waterfall(that.middleware, function(err, state) {
          if(err) return console.log(err)
          that.state = state
          seriesCallback(null, state)
        })
      } else {
        seriesCallback(null, state)
      }
    }, 
    function(state, seriesCallback) {
      var seedFunction = function(next) { next(null, state) }
      if(matchingRoute) {      
        //Give the waterfall a seed function with null error, parsed/matched route (req), and state: 
        if(!matchingRoute.seeded) { //but only if we haven't already done it: 
          matchingRoute.middleware.unshift({func: seedFunction })      
          matchingRoute.seeded = true      
        } else { //If already seeded, we overwrite the original seed function
          //(because command and state may have changed): 
          matchingRoute.middleware[0].func = seedFunction
        }
        //Create a copy of the middleware stack we are about to run
        //containing only the functions
        //(preparing the data structure for what async.waterfall will expect): 
        var middlewareToRun = _.map(matchingRoute.middleware, function(entry) { return entry.func })

        async.waterfall(middlewareToRun, function(err, state) {
          if(err) return callback(err)
          that.state = state //< Set this as latest state so it's available as prop.
          seriesCallback(null, state)
        })
      } else {
        //(no matching routes found)
        that.state = state 
        seriesCallback(null, state)
      }
    }, 
    function(state, seriesCallback) {
      //Fire any "last" middleware: 
      if(that.lastMiddleware) { 
        that.lastMiddleware[0] = function(next) { next(null, state) }
        async.waterfall(that.lastMiddleware, function(err, state) {
          if(err) return console.log(err)
          that.state = state //< Set the latest state. 
          return seriesCallback(null, state)
        })
      } else {
        seriesCallback(null, state)        
      }
    }, 
    function(state) {
      //Apply any previous state that was saved from before:
      if(that.command_queue.length > 0) state._command = that.command_queue.pop()
      //^ The reason to delete the command is to clear these values so that listeners 
      //listening to a parent command aren't 'passed up' the wrong req after
      // a child fire's callback occcurs. 
      if(_.isFunction(callback)) callback(null, state)                
    }
  ])
}


module.exports = stack
