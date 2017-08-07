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
  grid : gg.createGrid(3,3) 
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
    var existingRoute = _.find(that.routes, function(existingRoute) {
      return existingRoute.route.match(path)      
    })

    //The newMiddleware contains two properties; one is the callback
    //the other is the full path so we can later target/override this. 
    var newMiddleware = { func : listenerCallback, path: path }    
    // Wildcard paths naturally do not get added to other routes,
    // instead other paths are added to wildcard routes only after they
    // are defined.  Because we want wildcard paths to also work with prior
    // defined routes, then we must add the wildcard paths to the middlewares
    // of the other routes.
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

  var callee = arguments.callee 

  var caller
  if(arguments.callee.caller) caller = arguments.callee.caller.toString()

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
    state = param2
  }
  else if(_.isUndefined(param2)) {
    state = this.state
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
    if(callback) return callback(null, stack.state)
    else return 
  }

  if(matchingRoute) command.matching_route = matchingRoute
  if(callback) command.callback = callback
  command.caller = caller 

  //At this point if there is already a stack._command it means there is
  //a parent fire already in progress.
  if(state._command) {
    var enties = _.clone(stack.grid.enties)
    //stack.grid = gg.createGrid(enties.length + 1, enties.length +1) //< Premptiely create a new expanded grid
    stack.grid = gg.createGrid(3,3) //Create a fixed grid for now... 
    stack.grid.enties = enties //< restore original enties (commands), then add the new one

    //before we determine its cell, first determine if the current command is a parent or sibling...
    var cell  //DETERMINE SILBING OR CHILD: 
    if(state._command.caller != command.caller) { //< Sibling will share the same caller
      //Search the next row down: 
      cell = (stack.grid.enties.filter((enty) => enty.command.parent == state._command).length * stack.grid.width) +  stack.grid.width
      //also make note of parent... 
      command.parent = state._command
      //let's give the command reference to it's new child too: 
      state._command.child = command
    } else {
      //otherwise as a sibling the command will get a cell in the next column (same row)      
      cell = gg.xy(stack.grid, [0, enties.length] )
    }
    command.cell = cell 
    stack.grid = gg.insertEnty(stack.grid, { command: command, cell : cell })    
    stack.grid = gg.populateCells(stack.grid)

    if(window.renderGrid) window.renderGrid()          

    if(!command.parent) return  //< We return if sibling because the current command 
    //should finish first (stack will now call it upon completion; we just queued it)
    //If sibling, we fire right now!  Let's do a short circuit...
    _.defer(()=> {
      if(stack.state._command) {
        var nextFunc = stack.state._command.next
        delete stack.state._command.next
        return nextFunc(true)         
      } else {
        return 
      }
    })

  } else {
    //if no command active, we assume it is root level...
    //we need to expand the size of the grid... 
    var enties = _.clone(stack.grid.enties)
    //stack.grid = gg.createGrid(enties.length + 1, enties.length +1)
    stack.grid = gg.createGrid(3,3) 
    stack.grid.enties = enties //< restore original enties, then add new enty: 
    stack.grid = gg.populateCells(stack.grid)
    command.cell = gg.nextOpenCell(stack.grid)
    state._command = command   
    stack.grid = gg.insertEnty(stack.grid, { command : command, cell: command.cell })
    stack.grid = gg.populateCells(stack.grid) 
  }
  if(window.renderGrid) window.renderGrid()      
  waterfall(command)
}

var waterfall = (command) => {
  var matchingRoute = command.matching_route, 
      state = stack.state

  state._command = command   

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
            stack.fire('_buffer', (err, state, nextFire) => {
              //debugger
              if(!stack.state._command && _.isFunction(next)) return next()
              if(!stack.state._command) {
                console.log('no command.')
                console.log(next)
                //search the grid for any commands 
                var incompleteCommand = _.chain(stack.grid.enties)
                 .filter((enty) => enty.command.done)
                 .last()
                 .value().command
                 stack.state._command = incompleteCommand
                return incompleteCommand.next(null, stack.state)
              }
              if(stack.state._command) {
                stack.state._command.current_middleware_index++
              }
              if(next) {
                stack.state._command.next = next                                         
                return next(null, stack.state)
              } else {
                //Next was not supplied so we use the one saved
                //(ie- user did: next() with no params)
                if(stack.state._command.next) {
                  stack.state._command.next(null, stack.state)
                }
              }
            })
          }
          middlewareToRun.push(bufferFunction)
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
  function() {
    state = stack.state
    var next
    debugger
    // if(command.path == '/_buffer') {
    //   command.done = true
    // } 

    if(command.done) return 

    //search the next cell below (for children): 
    if(command.child && command.child.done) delete command.child 
    //^ if it's done then we delete the reference

    if(command.child) {
      var nextCommand = command.child

      //Fire!
      if(nextCommand) next = () => waterfall(nextCommand)
      else next = () => null

      state._command = command.child
      if(window.renderGrid) window.renderGrid()
      delete command.child
      return waterfall(state._command)

    } else if(command.parent) {
      //Determine if there are remaining middleware to run: 
      //otherwise the parent has no more middleware, 
      //so execute the parent's last command;
      command.done = true 
      if(window.renderGrid) window.renderGrid()                      
      if(command.callback) {
        debugger
        var commandCallback = _.clone(command.callback)
        delete command.callback
        delete command.parent.child
        command.parent.done = true
        var nextCommand
        //check for sibling: 
        if(command && stack.grid.cells[command.cell + 1] && stack.grid.cells[command.cell + 1].enties[0]) {
          nextCommand = stack.grid.cells[command.cell + 1].enties[0].command
          //Fire! (but make sure it isn't already fired (done))
          if(commandCallback) next = () => {
            commandCallback(null, stack.state, () => {
              if(nextCommand && !nextCommand.done) next = () => waterfall(nextCommand)
              else nextCommand = () => null
            })
          }
          if(nextCommand && !nextCommand.done) next = () => waterfall(nextCommand)
          else nextCommand = () => null
        } else {
          nextCommand = () => null
        }
        state._command = null
        if(window.renderGrid) window.renderGrid()
        if(command.parent.callback) return command.parent.callback(null, stack.state, nextCommand)
      }
      //Otherwise, search the next cell to the right (for siblings): 
      //(if state._command not existing nothing is queued anyway)          
      //perhaps right here do a check for any commands not yet done...
    } else if(state._command && stack.grid.cells[state._command.cell + 1] && stack.grid.cells[state._command.cell + 1].enties[0]) {
        var nextCommand = stack.grid.cells[state._command.cell + 1].enties[0].command
        //Fire!
        if(nextCommand && !nextCommand.done) next = () => waterfall(nextCommand)
        else next = () => null
    } else {
      next = () => null   
    }

    command.done = true
    state._command = null

    if(window.renderGrid) window.renderGrid()  

    if(command.callback) {
      var commandCallback = command.callback 
      delete command.callback
      commandCallback(null, state, next)
    }
  })
}


module.exports = stack
