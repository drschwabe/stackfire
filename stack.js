var async = require('async'), 
    _ = require('underscore'), 
    routeParser = require('route-parser'), 
    gg = require('gg'),    
    isNode = require('detect-node'), 
    _l = require('lodash')

var browser = false
if (!isNode) browser = true

var stack = { 
  routes : [], 
  state : {}, 
  grid : gg.createGrid(1,1) 
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

    existingRoute = existingRoute[0]

    var isWild = (~path.indexOf('*'))
    if(!isWild && existingRoute && existingRoute.route.spec.indexOf('*') > -1) existingRoute = false


    //there is another scenario to consider... to ensure the wildcard doesnt run twice
    //take aclose look at the stack object (routes and middleware specficailly) and determine the difference in the BEFORE and AFTER example; if I have to clone separate repos just to get two Inspector window opens to compare this.

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
        if(route.route.spec == '/_buffer') return route
        //if(route.route.spec == path) return route //Do not add itself.          
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
    that.routes = _.map(that.routes, (route, index) => {
      //if(route.route.spec == '/_buffer' || route.route.spec.indexOf('*') > -1) return null
      //if(route.route.spec == '/_buffer') return null       
      //if(route.route.spec.indexOf('*') > -1) return null   
      //if(route.route.spec ) 
      //if(route.middleware[0].path.indexOf('*') > -1) return null   
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
    //Ignore buffers and wildcards: 
    if(route.route.spec.indexOf('*') > -1 && path == '/_buffer') return false
    if(route.route.spec.indexOf('*') > -1 && path.indexOf('*') > -1) return false  
    if(path.indexOf('*') > -1) return false  
    return match
    //^ Parses the route; organizing params into a tidy object.    
  })

  //If the only match is a wildcard, do not make a new command: 
  //(this prevents wildcard listeners established after existing listeners not to run twice): 
  matchingRoutes = _.chain(matchingRoutes).map((route) => {
    if(route.route.spec.indexOf('*') > -1  && route.middleware[0].path && route.middleware[0].path.indexOf('*') > -1) {
      route.wildcard = true
    }
    return route
  }).compact().value()

  if(matchingRoutes.length == 2 && matchingRoutes[1].wildcard) matchingRoutes[1] = false 
  matchingRoutes = _.compact(matchingRoutes)

  if(!matchingRoutes.length) matchingRoutes[0] = {} //< Create a command obj anyway. 

  matchingRoutes.forEach((matchingRoute, index) => {  
    var newCommand = {} 
    newCommand.matching_route = matchingRoute
    //Make a property to store parameters (ie inventory/:widget <--)
    if(matchingRoute.route) newCommand.params = matchingRoute.route.match(path)
    newCommand.path = path
    //put the callback on the last matching route:  
    if(callback && index == matchingRoutes.length -1) newCommand.callback = callback
    //Store callee and caller for upcoming logic: 
    var callee = arguments.callee, 
        caller
        
    if(arguments.callee.caller) caller = arguments.callee.caller.toString()    
    newCommand.caller = caller 

    //At this point if there is already a stack._command it means there is
    //another fire already in progress.  Therefore, it must be queued.
    //We use a grid based queing model (leveraging gg library). 
    if(state._command && !state._command.done) {
      //Determine the cell; position on the grid the new command will be placed... 
      var cell 
      //first determine if the new command is a child or sibling... 
      if(state._command.caller == newCommand.caller) { //< Sibling will share the same caller. 
        //as a sibling the command will get a cell in the next column (same row): 

        //Expand grid size if necessary: 
        if(gg.isEastEdge(stack.grid, state._command.cell)){
          stack.grid = gg.expandGrid(stack.grid) 
          stack.grid.enties = _.map(stack.grid.enties, (enty) => {
            enty.command.cell = enty.cell 
            return enty
          })          
          stack.grid = gg.populateCells(stack.grid)
          if(window.renderGrid) window.renderGrid()                       
        }
        cell = gg.nextOpenCell(stack.grid)

      } else { //< this is a child of the current state._command:  
        //TODO: ^^ consider if better determination needed here! 
        //callers might be different but still be not a child of current command
        //(though perhaps this logic is sound; just seems like it needs to be examined/tested more closely)

        //Expand grid size if necessary: 
        if(gg.isSouthEdge(stack.grid, state._command.cell)){
          stack.grid = gg.expandGrid(stack.grid)
          stack.grid.enties = _.map(stack.grid.enties, (enty) => {
            enty.command.cell = enty.cell 
            return enty
          })          
          stack.grid = gg.populateCells(stack.grid)     
          if(window.renderGrid) window.renderGrid()                   
        }
    
        //search the next row down:  
        cell = gg.nextOpenCellSouth(stack.grid, state._command.cell)        

        //also make note of parent...  
        newCommand.parent = state._command 
        //give the command reference to it's new child too:  
        state._command.child = newCommand 
      }

      newCommand.cell = cell  //< finally assign the cell, then insert it into grid....

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
      stack.grid = gg.expandGrid(stack.grid)
      //We have to manually update cell nums on the command property of each enty: 
      stack.grid.enties = _.map(stack.grid.enties, (enty) => {
        enty.command.cell = enty.cell 
        return enty
      })
      stack.grid = gg.populateCells(stack.grid) 
      if(window.renderGrid) window.renderGrid()            

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
      if(matchingRoute && matchingRoute.middleware) {      
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
            //Possibly here we need to add something to mark a command as done...
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
            //console.log(`run a buffer func for ${stack.state._command.path}`)
            stack.state._command.current_middleware_index++
            return next(null, state)
            
            // stack.fire('/_buffer', (err, state) => {
            //   //console.log('buffer func complete')
            //   stack.state._command.current_middleware_index++
            //   return next(null, state)
            // })
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
    stack.state._command.done = false  
    return waterfall(newCommand)
  }
  if(!stack.state._command) return
  //state._command.done = true  
  stack.state._command.middleware_done = true 
  if(window.renderGrid) window.renderGrid()

//possily here is calling nextCommand but not making note that 
  debugger
  if(stack.state._command.done) return nextCommand()

  //If there is a parent - return and continue where it left off:
  if(stack.state._command.parent && !stack.state._command.parent.done ) {
    //Make a copy and then overwrite the state._command with the parent command.       
    //var newCommand = _.clone(state._command.parent)
    //state._command = state._command.parent 
    //Make sure we run the callback before switching context to the parent command: 
    if(stack.state._command.callback && !stack.state._command.callback_underway) {
      var nextFire = (callback) => { 
        //_.defer(() => {
          debugger
          //determine if the current command's callback has already been run...
          if(stack.state._command.done) return //< This should never happen...
          stack.state._command.callback_underway = false
          stack.state._command.done = true
          if(callback) callback() //< This type of callback must be a synchronous function!
          //(cause we are not returning it; we are proceeding to resume waterfall..
          //we are lazy and want only sync functions for now
          //(presumably async func support can be added here later)
          return resumeWaterfall(state._command.parent)          
        //}, 100)
      }
      stack.state._command.callback_underway = true 
      return stack.state._command.callback(null, stack.state, nextFire)
    } else {
      //return stack.state._command.next(null, stack.state)
      stack.state._command.done = true
      return resumeWaterfall(state._command.parent)      
    }    
  }
  
  //Determine if there is a sibling: 
  var siblingCommand
  stack.grid = gg.populateCells(stack.grid)
  var nextCol = gg.nextCol(stack.grid, stack.state._command.cell)
  if(nextCol) {
    siblingCommand = nextCol[0].command
  }
  // var commandCallback = state._command.callback 
  //Before nulling command, update the grid enties (cause we cloned earlier and now properties have 
  //deviated :/ ) 
  //_.findWhere(stack.grid.enties, { cell: state._command.cell }).command = state._command
  //state._command = null
  //Otherwise, just run the callback...

  if(state._command.callback) {
      //if(state._command.done) return nextCommand()
    var nextFire = (callback) => {
      //if(callback) stack(callback) //This queues a given function to the middleware of the
        //current running command: 
        //I think it should be non destructive... ie- run it after the command... is done. 
      if(stack.state._command.done) return //< This should never happen...
      console.log('all done (with callback)')  
      stack.state._command.done = true
      if(callback) callback() //< This type of callback must be synchronous!
      if(window.renderGrid) window.renderGrid()  
      if(siblingCommand) {
        console.log('run sibling command...')
        return waterfall(siblingCommand)
      } else { //Even if no sibling from before, it is possible a new sibling 
        //has occurred so we run nextCommand() it should figure it out: 
        console.log('no siblings found, try nextCommand()')
        return nextCommand()
      }
    }
    return state._command.callback(null, stack.state, nextFire)
  } else {
    state._command.done = true      
    console.log('all done (no callback)') 
    if(window.renderGrid) window.renderGrid()    
    if(siblingCommand) {
      console.log('run sibling command...')
      return waterfall(siblingCommand)  
    }    
  }
}

var resumeWaterfall = (command) => {

  if(!command) return console.log('no command supplied ')

  var matchingRoute = command.matching_route, 
      state = stack.state

  state._command = command   

  if(!command.matching_route.middleware) {
    console.log('no more matching_route middleware...')
    //check if the command ... 
    //command.done = true 
    if(window.renderGrid) renderGrid()
    if(!command.done && command.callback) {
      if(command.parent && !command.parent.done) return nextCommand()
      else return endWaterfall()
    } else {
      return console.log('okay maybe nothing else left to do!')
    }
  }
  //If we already at the end of the middleware - just end it: 
  if(command.current_middleware_index == command.matching_route.middleware.length || command.current_middleware_index + 1 == command.matching_route.middleware.length) endWaterfall()

  //is there still a callback to run? 
  //if(command.callback)

  //end waterfall, which will finish any callback: 
  return endWaterfall()

  console.log('all done everything!')
  state._command = null 
  return 

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

var nextCommand = () => {
  //Determine the next command to run.... 
  var incompleteCommands = _.filter( stack.grid.enties, (enty) => !enty.command.done && !enty.command.middleware_done)
  //start with the last one... 
  if(!incompleteCommands || _.isEmpty(incompleteCommands)) return console.log('okay really all done now')
  debugger
  var lastIncompleteCommand = _.last(incompleteCommands).command

  if(!lastIncompleteCommand) return console.log('like really really really all done now')
  debugger
  return resumeWaterfall( lastIncompleteCommand )
  //this is causing loop I think 
}

module.exports = stack
