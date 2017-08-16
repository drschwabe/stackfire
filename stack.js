var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser'), 
    createHtmlElem = require('create-html-element'), 
    gg = require('gg'),    
    isNode = require('detect-node'), 
    _l = require('lodash')

var browser = false
if (!isNode) browser = true

var stack = { 
  routes : [], 
  state : {}, 
  grid : gg.createGrid(12,12) 
}
stack.grid = gg.populateCells(stack.grid)


stack.on = function(param1, callback) {
  //param1: a string or an array of strings.
  //(is either a single path or array of paths)  

  var that = this
  var registerRoute = function(path, listenerCallback) {

    //Ensure path always is prefixed with a slash: 
    if(path.substr(0, 1) != '/') path = '/' + path

    var route = new routeParser(path)
    var existingRoute = _.filter(that.routes, function(existingRoute) {
      return existingRoute.route.match(path)
    })

   // if(existingRoute && existingRoute.route.spec.indexOf('*') > -1 && path.indexOf('*') == -1) existingRoute = false


    existingRoute = existingRoute[0]

    var isWild = (~path.indexOf('*'))
    if(!isWild && existingRoute && existingRoute.route.spec.indexOf('*') > -1) existingRoute = false

    //Wildcards will be included in the matches, but we dont want them 
    //unless they are the only route: 
    // if(existingRoute.length > 1) {
    //   existingRoute = _.find(that.routes, function(existingRoute) {
    //     return existingRoute.route.spec.indexOf('*') == -1
    //   })
    // } else if(existingRoute.length == 1) {
    //   existingRoute = existingRoute[0]
    // } else {
    //   existingRoute = false 
    // }


    //if(existingRoute && existingRoute.route.spec.indexOf('*') > -1) existingRoute = false

    //The newMiddleware contains two properties; one is the callback
    //the other is the full path so we can later target/override this. 
    var newMiddleware = { func : listenerCallback, path: path }    
    // Wildcard paths naturally do not get added to other routes,
    // instead other paths are added to wildcard routes only after they
    // are defined.  Because we want wildcard paths to also work with prior
    // defined routes, then we must add the wildcard paths to the middlewares
    // of the other routes...
    if (isWild) { 

      that.routes = _.map(that.routes, (route) => {
        //except for /_buffer routes:  
        //if(route.route.spec == path) return route //Do not add itself.
              //except for /_buffer routes:  
        if(route.route.spec == '/_buffer') return route
        return Object.assign({}, route, {middleware: [...route.middleware, newMiddleware]})
      })
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
    return

    //the other startegy here is to operate on the routes heres / middleware here: 
    that.routes = _.map(that.routes, (route) => {
      //if(route.route.spec == '/_buffer' || route.route.spec.indexOf('*') > -1) return null
      //if(route.route.spec == '/_buffer') return null       
      if(route.route.spec.indexOf('*') > -1) return null       
      return route
    })
    that.routes = _.compact(that.routes)
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

  if(path.substr(0, 1) != '/') path = '/' + path //< Ensure path is always prefixed with '/'

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
    state = param2
  }
  else if(_.isUndefined(param2)) {
    state = this.state
  }

  //Prepare the new command object: 
  var matchingRoutes = _.filter(this.routes, function(route) {
    var match =  route.route.match(path)
    if(route.route.spec.indexOf('*') > -1 && path == '/_buffer') return false
    return match
    //^ Parses the route; organizing params into a tidy object.    
  })

  if(!matchingRoutes.length) {
    if(callback) return callback(null, stack.state) 
    //^ No matching routes, but as a courtesy we will execute your callback anyway.
    else return 
  }

  matchingRoutes.forEach((matchingRoute, index) => {    
    var newCommand = {} 
    newCommand.matching_route = matchingRoute
    newCommand.path = path
    //put the callback on the last matching route:  
    if(callback && index == matchingRoutes.length -1) newCommand.callback = callback
    //Store callee and caller for upcoming logic: 
    var callee = arguments.callee, 
        caller
        
    if(arguments.callee.caller) caller = arguments.callee.caller.toString()    
    newCommand.caller = caller 

    //At this point if there is already a stack._command it means there is
    //a parent fire already in progress.  Therefore, it must be queued.
    //We use a grid based queing model (leveraging gg library). 
    if(state._command && !state._command.done) {
      var existingCommands = _.clone(stack.grid.enties) //< Clone a copy of all existing commands.
      stack.grid = gg.createGrid(12,12) //< Create a new grid (overwriting any previous one)
      //^ Grid fixed at 3x3 for now until gg supports dynamic grid resizing from top-left to bottom-left). 
      stack.grid.enties = existingCommands //< Restore original commands to the new grid.  

      //Determine the cell; position on the grid the new command will be placed... 
      var cell 
      //first determine if the new command is a parent or sibling... 
      if(state._command.caller == newCommand.caller) { //< Sibling will share the same caller. 
        //as a sibling the command will get a cell in the next column (same row):     
        stack.grid = gg.populateCells(stack.grid)       
        cell = gg.nextOpenCell(stack.grid)
      } else { //< this is a child of the current state._command:  
        //TODO: ^^ consider if better determination needed here! 
        //callers might be different but still be not a child of current command
        //(though perhaps this logic is sound; just seems like it needs to be examined/tested more closely)

        stack.grid = gg.populateCells(stack.grid) 

        //search the next row down:  
        cell = gg.nextOpenCellDown(stack.grid, state._command.cell)

        //also make note of parent...  
        newCommand.parent = state._command 
        //give the command reference to it's new child too:  
        state._command.child = newCommand 
      }

      newCommand.cell = cell  //< finally assign the cell, then insert it into grid: 
      stack.grid = gg.insertEnty(stack.grid, { command: newCommand, cell : cell })     
      stack.grid = gg.populateCells(stack.grid) 
   
      if(window.renderGrid) window.renderGrid()  

      if(!newCommand.parent) return  //< We return if sibling because the current command  
      //should finish first (stack will now call it upon completion; we just queued it) 

      //If child, end the parent's in-progress middlestack waterfall: 
      endWaterfall(newCommand)
      //callback()
    } else {
      //Otherwise, if no command active, we assume it is root level... 
      var existingCommands = _.clone(stack.grid.enties) 
      stack.grid = gg.createGrid(12,12)  
      stack.grid.enties = existingCommands //< restore original commands, then add this new one... 
      stack.grid = gg.populateCells(stack.grid) 
      newCommand.cell = gg.nextOpenCell(stack.grid) //then find next open cell...
      stack.grid = gg.insertEnty(stack.grid, { command : newCommand, cell: newCommand.cell }) 
      stack.grid = gg.populateCells(stack.grid) //<^ insert and re-populate the grid cells. 

      if(window.renderGrid) window.renderGrid()      
      waterfall(newCommand) //< finally, run the middleware waterfall! 
      //callback()
    }
  })
}

var waterfall = (command) => {

  var matchingRoute = command.matching_route, 
      state = stack.state

  state._command = command   
  if(window.renderGrid) window.renderGrid()  

  async.series([
    function(seriesCallback) {
      var seedFunction = function(next) { 
        stack.state._command.current_middleware_index = 0 
        next(null, state) 
      }
      if(matchingRoute) {      
        //Give the waterfall a seed function with null error, parsed/matched route (req), and state: 
        if(!matchingRoute.seeded) { //but only if we haven't already done it: 
          matchingRoute.middleware.unshift({func: seedFunction })      
          matchingRoute.seeded = true      
        }
        //Capture the "next" argument such that we may apply it to the stack object; 
        //making possible to invoke it from outside (ie- so stack.fire can do stack.next() to advance execution through the grid)...

        //add a 'buffer' function after each middleware function to do this
        //also keep track of the current middleware index. 
        var middlewareToRun = []
        matchingRoute.middleware.forEach((entry, index) => {
          //Capture next: 
          var middlewareFunc = _l.overArgs(entry.func, (stateOrNext) => {
            if(!_.isFunction(stateOrNext)) return stateOrNext
            //If it's not a function, it is the state object: 
            if(stack.state._command) stack.state._command.next = stateOrNext 
            return stateOrNext          
          })
          middlewareToRun.push(middlewareFunc)
          var bufferFunction = (state, next) => {
            if(!state || !next) {
              //return null
              console.log('state or next missing')
              console.log(state)
              console.log(next)
          
              //return
            }
            if(_.isFunction(state)) next = state
            //console.log(next)
            console.log(`run a buffer func for ${stack.state._command.path}`)
      
            stack.fire('/_buffer', (err, state) => {
              console.log('buffer func complete')
              stack.state._command.current_middleware_index++
              return next(null, state)
            })
          }
          //Only push the buffer function/fire if A) we are not already running
          //a buffer and B) we have reached the end of the middleware.
          //if(state._command.path != '/_buffer' && index != matchingRoute.middleware.length) return middlewareToRun.push(bufferFunction)  
          if(stack.state._command && stack.state._command.path != '/_buffer' && index != matchingRoute.middleware.length -1) return middlewareToRun.push(bufferFunction)
          return
        })
        async.waterfall(middlewareToRun, function(err, state) {
          if(err) return seriesCallback(err) //< Err for now being just used 
          //as a way to short circuit command in progress. 
          return seriesCallback(null, state)
        })
      } else {
        //(no matching routes found; fire a 'blank' (callback still executes))
        return seriesCallback(null, state)
      }
    }
  ], 
  endWaterfall)
}

var endWaterfall = (newCommand) => { //End of waterfall: 
  var state = stack.state
  if(newCommand) {
    state._command.done = false  
    return waterfall(newCommand)
  }
  if(!state._command) return
  state._command.done = true  
  if(window.renderGrid) window.renderGrid()

  debugger

  //otherwise, if there is a parent - return and continue where it left off:
  if(state._command.parent) {
    //Make a copy and then overwrite the state._command with the parent command.       
    var oldCommand = _.clone(state._command)
    debugger
    state._command = state._command.parent 
    //Make sure we run the callback before switching context to the parent command: 
    if(oldCommand.callback) {
      return oldCommand.callback(null, stack.state, () => {
        return resumeWaterfall(stack.state._command)
      })
    } else {
      debugger
      //return stack.state._command.next(null, stack.state)
      return resumeWaterfall(stack.state._command)      
    }    
  }

  var siblingCommand
  //Determine if there is a sibling: 
  stack.grid = gg.populateCells(stack.grid)
  if(gg.examine(stack.grid, stack.state._command.cell + 1)) {
    siblingCommand = _.findWhere(stack.grid.enties, { cell: stack.state._command.cell + 1 }).command
    siblingCommand = _.clone(siblingCommand)
  }
  var commandCallback = state._command.callback 
  state._command = null
  //Otherwise, just run the callback...
  if(commandCallback) {
    var nextCommand
    if(siblingCommand) nextCommand = () => { return waterfall(siblingCommand) }
    else nextCommand = () => null 
    if(window.renderGrid) window.renderGrid()
    return commandCallback(null, state, nextCommand)      
  }
  if(siblingCommand) waterfall(siblingCommand)
  if(window.renderGrid) window.renderGrid()
  console.log('all done') 
}

var resumeWaterfall = (command) => {

  var matchingRoute = command.matching_route, 
      state = stack.state

  state._command = command   

  //If we already at the end of the middleware - just end it: 
  if(command.current_middleware_index == command.matching_route.middleware.length || command.current_middleware_index + 1 == command.matching_route.middleware.length) endWaterfall()

  debugger

  // async.series([
  //   function(seriesCallback) {

  //     var middlewareToRun = [function(next) { 
  //       //stack.state._command.current_middleware_index = 0 
  //       next(null, state) 
  //     }]
  //     //No need to add buffers, they already in there.

  //     //Create a copy of the command's middleware, removing the functions
  //     //already run...
  //     seriesCallback()
  //   }
  // ], 
  //endWaterfall
}

module.exports = stack
