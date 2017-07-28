var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser'), 
    createHtmlElem = require('create-html-element'), 
    gg = require('gg'),    
    isNode = require('detect-node');

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
    console.log('render grid')
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
    debugger
    if(callback) return callback
    else return 
  }

  if(matchingRoute) command.matching_route = matchingRoute
  if(callback) command.callback = callback

  //At this point if there is already a stack._command it means there is
  //a parent fire already in progress.
  if(state._command) {
    console.log('there is a command!')
    debugger    
    var enties = _.clone(stack.grid.enties)
    stack.grid = gg.createGrid(enties.length + 1, enties.length +1) //< Premptiely create a new expanded grid:
    stack.grid.enties = enties //< restore original enties, then add new enty: 
    command.cell = gg.xy(stack.grid, [0, enties.length] )
    stack.grid = gg.insertEnty(stack.grid, { command: command, cell : [0, enties.length ] })    
    stack.grid = gg.populateCells(stack.grid)
    //state._command = command
    return  //< we return because the current command will 
    //call the command just fired; we just queued it. 
  } else {
    //if no command active, we assume it is root level...
    //stack.grid = gg.populateCells(stack.grid)
    //we need to exapnd the size of the grid... 

    var enties = _.clone(stack.grid.enties)
    stack.grid = gg.createGrid(enties.length + 1, enties.length +1)
    stack.grid.enties = enties //< restore original enties, then add new enty: 
    stack.grid = gg.populateCells(stack.grid)
    command.cell = gg.nextOpenCell(stack.grid)
    state._command = command   
    stack.grid = gg.insertEnty(stack.grid, { command : command, cell: command.cell })
    stack.grid = gg.populateCells(stack.grid) 
    //insert this in sequence -- OR insert into rightmost-est column
  }

  if(browser) renderGrid()

  debugger 

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
        //Create a copy of the middleware stack we are about to run
        //containing only the functions
        //(preparing the data structure for what async.waterfall will expect): 
        var middlewareToRun = _.map(matchingRoute.middleware, function(entry) { return entry.func })

        async.waterfall(middlewareToRun, function(err, state) {
          if(err) return callback(err)
          //stack.state = state //< Set this as latest state so it's available as prop.
          seriesCallback(null, state)
        })
      } else {
        //(no matching routes found; fire a 'blank' (callback still executed))
        seriesCallback(null, state)
      }
    },
    function(state) {
      console.log(`"${command.path}" command completed firing...`)
      console.log(command)
      if(!state) state = stack.state
      var next 
      //find the next cell in the grid (if existing); see if there is a new command waiting....
      //(but if state._command not existing nothing is queued anyway)
      //debugger
      debugger
      if(state._command && stack.grid.cells[state._command.cell + 1] && stack.grid.cells[state._command.cell + 1].enties[0]) {
        var nextCommand = stack.grid.cells[state._command.cell + 1].enties[0].command
        //Fire!
        if(nextCommand) next = () => waterfall(nextCommand)
        else next = () => null
      } else {
        next = () => null
      }
      //need to consider this... this will return the command - but the user
      //needs a function to execute... hmmm. 
      //very close... should we have the command just sort of recreate at this point
      //such that we can make 'next' :   stack.fire('path')  ? hmmmm

      //a littler above I am referring to functions to call as ".func"

      command.done = true

      if(browser) renderGrid()      

      state._command = null

      //(somehow ensure we are looking down first, and then look right) 
      if(command.callback) command.callback(null, state, next)
    }
  ])  
}


module.exports = stack
