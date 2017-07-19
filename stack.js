var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser'), 
    createHtmlElem = require('create-html-element'), 
    gg = require('gg')    

var browser = false
if (typeof window === 'undefined') {
  console.log('load jquery')
  var $ = require('jquery')  
  browser = true
} else {
  console.log('do not load jquery')  
}

var stack = { 
  routes : [], 
  state : {}, 
  command_queue : [], 
  command_history : [],   
  next_queue : [], 
  fire_queue : [], 
  sequence : 0 //We track only sequence; depth is measured on the command at the given sequence slot.
}

stack.grid = gg.createGrid(3,3)
stack.grid = gg.populateCells(stack.grid)

if(browser) {
  var renderGrid = () => {
    //  stack.grid = gg.populateCells(stack.grid)

    $('#vizgrid').html('')
    stack.grid.cells.forEach((cell,index) => {
      let entyCell = createHtmlElem({
        name : 'div', 
        attributes : {
          class : 'col-4 border border-silver p2 center', 
          id : index
        }
      })
      $('#vizgrid').append(entyCell)
      //Append a 'firebox' if any: 
      var fireEnty = gg.examine(stack.grid, index) 
      //debugger
      if( fireEnty ) {
        $('#vizgrid #' + index).append(
          createHtmlElem({
            name : 'div', 
            attributes : {
              class : 'center blue bg-white border border-gray p2 h5', 
              id : index
            }, 
            value : fireEnty.path
          })
        )
      }    
    })
  }

}


stack.on = function(param1, callback) {
  //param1: a string or an array of strings.
  //(is either a single path or array of paths)  

  var that = this
  var registerRoute = function(path, listenerCallback) {

    //Ensure path always is prefixed with a slash: 
    if(path.substr(0, 1) != '/') path = '/' + path

    var route = new routeParser(path)
    var existingRoute = _.find(that.routes, function(existingRoute) {
      return existingRoute.route.match(path)      
    })
    //The newMiddleware contains two properties; one is the callback
    //the other is the full path so we can later target/override this. 
    var newMiddleware = { func : listenerCallback, path: path }    
    // wildcard paths naturally do not get added to other routes,
    // instead other paths are added to wildcard routes only after they
    // are defined.  Because we want wildcard paths to also work with prior
    // defined routes, then we must add the wildcard paths to the middlewares
    // of the other routes.
    // This could get tricky though, and more testing is needed to make sure
    // this does not introduce even more problems.
    var isWild = (~path.indexOf('*'))
    if (isWild) {
      that.routes = that.routes.map(routes => Object.assign({}, routes, {middleware: [...routes.middleware, newMiddleware]}))
    }
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

  if(path.substr(0, 1) != '/') path = '/' + path    


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

  if(!command) {
    console.log('no matching route (no listeners) defined.')
    if(callback) return callback
    else return 
  }

  //At this point if there is already a stack._command it means there is
  //a parent fire already in progress.
  if(state._command) {
    //so determine which one takes priority, and adjust the queue accordingly..
    //analzye the sequence (x direction)
    console.log(state._command.sequence)
    console.log(command.sequence)    
    //firt, let's measure the depth of the current command...
    //how do we determine to add to the x or the y? 
    //we need to determine if there is sequence
    //sequence gets reduced at the end
    //this way we dont have to track parents/children
    //we know that if ever there is sequence slots it means there is queue
    //if sequence is 0 it means there is nothing in the queue 

    //but still how do we figure out... depth
    //for now i'll just make everything add to sequence ..
    //but somehow we need to determine if a fire is already in progress... 

    //for now just queue everything: 
    stack.command_queue = command 
    debugger    
    return 
  } else {
    //if no command active, we assume it is root level;
    //We assign it a sequence based on stack sequence property
    command.sequence = stack.sequence + 1
    //(sequence is just number of fires occurred at root level)
    //and then apply it to state: 
    state._command = command        
  }

  //stack.grid = gg.insertEnty(stack.grid, { cell: gg.xy(stack.grid, command.depth, command.sequence), path : command.path })

  stack.grid = gg.insertEnty(stack.grid, { cell: stack.sequence, path : command.path })
 
  if(browser) renderGrid()

  var that = this

  async.waterfall([
    function(seriesCallback) {
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
    function(state) {
      //Apply any previous state that was saved from before:
      if(that.command_queue.length > 0) state._command = that.command_queue.pop()
      //^ The reason to delete the command is to clear these values so that listeners 
      //listening to a parent command aren't 'passed up' the wrong req after
      // a child fire's callback occcurs. 

      //Remove the first element of the stack.fire_queue: 
      stack.fire_queue.shift()
      //If there is aything left in the queue, fire it...       
      if(stack.fire_queue.length) {
        //only fire if it is a different depth!  
        if( stack.fire_queue[0].params[0] != path && stack.depth != stack.fire_queue[0].depth ) {
          stack.fire( stack.fire_queue[0].params[0], stack.fire_queue[0].params[1], stack.fire_queue[0].params[2])
        } else {
          //otherwise it was already called, so remove it: 
          stack.fire_queue.shift()
        } //^^ this may cause a bug in whereby it will only apply one-time; we need to apply this logic
        //recursively to x number of potential fires in the queue
        //ie: stack.fire_queue.forEach
        //alternatively; might call the callback .... 
      }
      stack.sequence-- //< should now be 0
      debugger
      if(_.isFunction(callback)) callback(null, state)
    }
  ])
}


module.exports = stack
