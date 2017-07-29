var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser'), 
    createHtmlElem = require('create-html-element'), 
    gg = require('gg'),    
    isNode = require('detect-node'), 
    _l = require('lodash')

var browser = false
if (!isNode) {
  var $ = require('jquery')  
  browser = true
}

var stack = { 
  routes : [], 
  state : {}, 
  grid : gg.createGrid(1,1) 
}
stack.grid = gg.populateCells(stack.grid)

if(browser) {
  window.renderGrid = () => {
    $('#vizgrid').html('')      
    stack.grid.cells.forEach((cell,index) => {
      let entyCell = createHtmlElem({
        name : 'div', 
        attributes : {
          class : 'border border-silver p2 center col-6', 
          id : index
        }
      }) //could implement a dynamic column class based on size of grid
      $('#vizgrid').append(entyCell)
      var enty = gg.examine(stack.grid, index)       
      if( enty ) {
        $('#vizgrid #' + index).append(
          createHtmlElem({
            name : 'div', 
            attributes : {
              class : `center blue bg-white border border-gray p2 h5 ${enty.command.done ? 'bg-teal' : ''}`, 
              id : index
            }, 
            value : enty.command.path
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

  var caller = arguments.callee.caller.toString()
  var callerName = arguments.callee.caller.name

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
    if(callback) return callback
    else return 
  }

  if(matchingRoute) command.matching_route = matchingRoute
  if(callback) command.callback = callback
  command.caller = caller 

  //At this point if there is already a stack._command it means there is
  //a parent fire already in progress.
  debugger
  if(state._command) {
    debugger
    var enties = _.clone(stack.grid.enties)
    stack.grid = gg.createGrid(enties.length + 1, enties.length +1) //< Premptiely create a new expanded grid:
    stack.grid.enties = enties //< restore original enties, then add new enty: 
    //Before we determine the cell, we must determine if the current command is a parent or sibling.

    //if its not done... well, that wont help us
    //if(!state._command.done) 

    var cell  //DETERMINE SILBING OR CHILD: 
    if(state._command.caller != command.caller) {  
      //if it's a child, give it a cell number/position exactly row below (same column)      
      cell = state._command.cell + stack.grid.width
      //also make note of parent... 
      command.parent = state._command.path
      //let's give the command reference to it's new child too: 
      state._command.child = command
    } else {
      //otherwise as a sibling the command will get a cell in the next column (same row)      
      cell = gg.xy(stack.grid, [0, enties.length] )
    }
    command.cell = cell 
    stack.grid = gg.insertEnty(stack.grid, { command: command, cell : cell })    
    stack.grid = gg.populateCells(stack.grid)

    if(!command.parent) return  //< We return if sibling because the current command 
    //should finish first (stack will now call it upon completion; we just queued it)
    //If sibling, we fire right now!  Let's do a short circuit...
    return state._command.next(true) //< Calling next on a command with a child command will 
    //fire said child command. 
  } else {
    //if no command active, we assume it is root level...
    //we need to exapnd the size of the grid... 
    var enties = _.clone(stack.grid.enties)
    stack.grid = gg.createGrid(enties.length + 1, enties.length +1)
    stack.grid.enties = enties //< restore original enties, then add new enty: 
    stack.grid = gg.populateCells(stack.grid)
    command.cell = gg.nextOpenCell(stack.grid)
    state._command = command   
    stack.grid = gg.insertEnty(stack.grid, { command : command, cell: command.cell })
    stack.grid = gg.populateCells(stack.grid) 
  }
  if(browser) renderGrid()
  waterfall(command)
}

var waterfall = (command) => {
  var matchingRoute = command.matching_route, 
      state = stack.state
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
        //Create a mapped copy of the middleware stack we are about to run
        //containing only the functions
        //(preparing the data structure for what async.waterfall will expect)...

        //Also caputure the "next" argument such that we may apply it to the stack object; 
        //making possible to invoke it from outside (ie- so stack.fire can do stack.next() to advance execution through the grid)
        var captureNext = (stateOrNext) => {
          if(!_.isFunction(stateOrNext)) return stateOrNext
          stack.state._command.next = stateOrNext 
          return stateOrNext
        }
        var middlewareToRun = _.map(matchingRoute.middleware, function(entry) { 
          return _l.overArgs(entry.func, captureNext)
        })
        //debugger
        async.waterfall(middlewareToRun, function(err, state) {
          if(err) return seriesCallback(err) //< Err for now being just used 
          //as a way to short circuit command in progress. 
          seriesCallback(null, state)
        })
      } else {
        //(no matching routes found; fire a 'blank' (callback still executes))
        seriesCallback(null, state)
      }
    },
    function() {
      //if(state._command) nextCell(command)
      state = stack.state
      var next 
      //find the next cell in the grid (if existing); see if there is a new command waiting....
      //Search the next cell below in same column: 

      //If there is a _command at this point it means we have a command which is already firing....

      //Short circuit it! 
      //this will cause the final function to invoke....
      //clearing the _.command 
      //(effectively re-runs this)
      //TODO: copy the existing / remaining stack in the 'in progress waterfall'
      //so we may run them after this one finishes 
      // if(state._command && !state._command.intercepted) {
      //   state._command.intercepted = true
      //   debugger
      //   return state._command.next(true)
      // }
      //hmmmm - yes, we want to short circuit it however, THIS function itself only runs if either a short circuit state._command.next(true) is run or the command finishes entirely; so the short-circuit state._command.next(true) needs to be called earlier

      if(state._command && stack.grid.cells[state._command.cell + stack.grid.width] && stack.grid.cells[state._command.cell + stack.grid.width].enties[0]) {
        var nextCommand = stack.grid.cells[state._command.cell + stack.grid.width].enties[0].command
        //Fire!
        if(nextCommand) next = () => waterfall(nextCommand)
        else next = () => null
        //Otherwise, search the next cell: 
        //(if state._command not existing nothing is queued anyway)          
      } else if(state._command && stack.grid.cells[state._command.cell + 1] && stack.grid.cells[state._command.cell + 1].enties[0]) {
          var nextCommand = stack.grid.cells[state._command.cell + 1].enties[0].command
          //Fire!
          if(nextCommand) next = () => waterfall(nextCommand)
          else next = () => null
      } else {
        next = () => null   
      }

      //debugger

      command.done = true

      if(browser) renderGrid()      

      state._command = null

      if(command.callback) command.callback(null, state, next)
    }
  ])
}


module.exports = stack
