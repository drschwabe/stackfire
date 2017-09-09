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
    var newCommand = {
      children_awaiting : 0
    } 
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
      var sibling = false 
      if(state._command.caller == newCommand.caller) { //< Sibling will share the same caller. 
        //a sibling command needs to go into the cell in the next column (same row): 
        //if(state._command.caller.parent && state._command.caller.parent.caller != newCommand.caller) sibling = true
        
        sibling = state._command
      }
      if(state._command.parent && state._command.parent.caller == newCommand.caller) sibling = true

      if(sibling) { 
        //Expand grid size if necessary: 
        //find the easternmost command... 
        if(gg.isEastEdge(stack.grid, gg.nextOccupiedCellEast(stack.grid, state._command.cell))){
          stack.grid = gg.expandGrid(stack.grid) 
          stack.grid.enties = _.map(stack.grid.enties, (enty) => {
            enty.command.cell = enty.cell 
            return enty
          })          
          stack.grid = gg.populateCells(stack.grid)
          if(stack.renderGrid) stack.renderGrid()    
          //TODO: replace with a general 'sync middleware hook' in whereby any module could
          //perform a sync function here                   
        }
        cell = gg.nextOpenCellEast(stack.grid, stack.state._command.cell)
        if(sibling.parent) newCommand.parent = sibling.parent
        //^ this might override the proper sibling which could be not necessarily the parent of the other sibling...  

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
          if(stack.renderGrid) stack.renderGrid()                   
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

      //update next...
      stack.grid.enties = _.map(stack.grid.enties, (enty) => {
        //debugger
        //enty.command.next = 
        //^ determine the logic for what command to run next....
        //this should be very similar to stack.next() itself.... 
        return enty
      }) 

      if(stack.renderGrid) stack.renderGrid()  

      
      if(sibling) return  //< We return if sibling because the current command  
      //should finish first (stack will now call it upon completion; we just queued it) 

      //If child, end the parent's in-progress middlestack waterfall: 
      return endWaterfall(newCommand)
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
      if(stack.renderGrid) stack.renderGrid()            

      newCommand.cell = gg.nextOpenCell(stack.grid) //then find next open cell...
      stack.grid = gg.insertEnty(stack.grid, { command : newCommand, cell: newCommand.cell }) 
      stack.grid = gg.populateCells(stack.grid) //<^ insert and re-populate the grid cells. 

      if(stack.renderGrid) stack.renderGrid()      
      waterfall(newCommand) //< finally, run the middleware waterfall! 
      //callback()
    }
  })
}

var waterfall = (command) => {

  var matchingRoute = command.matching_route, 
      state = stack.state

  state._command = command   
  if(stack.renderGrid) stack.renderGrid()  
  async.series([
    function(seriesCallback) {
      var seedFunction = function(next) { 
        stack.state._command.current_middleware_index = 0 
        stack.state._command.middleware_done = false
        stack.state._command.matching_route.middleware = _.map(stack.state._command.matching_route.middleware, (entry) => {
          entry.done = false 
          return entry 
        })
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
            //may neeed to do something here weher we caputre next... and applyit.. 
            //wait - already have it up there ...
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

            //Mark middleware as complete: 
            stack.state._command.matching_route.middleware[stack.state._command.current_middleware_index].done = true
            stack.state._command.current_middleware_index++

            //return next(null, state)
            
            return stack.state._command.next()
            return stack.next()
            
            // stack.fire('/_buffer', (err, state) => {
            //   //console.log('buffer func complete')
            //   stack.state._command.current_middleware_index++
            //   return next(null, state)
            // })
          }
          //Only push the buffer function/fire if A) we are not already running
          //a buffer and B) we have reached the end of the middleware.
          //if(state._command.path != '/_buffer' && index != matchingRoute.middleware.length) return middlewareToRun.push(bufferFunction)  
          //if(stack.state._command && stack.state._command.path != '/_buffer' && index != matchingRoute.middleware.length) return middlewareToRun.push(bufferFunction)
          //if(index != matchingRoute.middleware.length) middlewareToRun.push(bufferFunction)
          
          middlewareToRun.push(bufferFunction)
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
    //Do a check to see if the middleware is done, and mark accordingly: 
    if(_.every(stack.state._command.matching_route.middleware, (entry) => entry.done)) {
      stack.state._command.middleware_done = true 
    }

    //assume callback is invoked and now we done... 
    if(stack.state._command.middleware_done && stack.state._command.callback_invoked) {
      //.... it's not done however... IF the newCommand is a child AND the parent is 
      //having its callback_invoked...  
      if(newCommand.parent == stack.state._command) {
        if(stack.state._command.callback_invoked && !stack.state._command.done) {
          stack.state._command.done = false //< Not done yet, not until the child fire is done...  
          stack.state._command.children_awaiting++ //Increase this so that if there are 
          //multiple children executing we know when to mark the command as done.      
        }
      } else {
        stack.state._command.done = true        
      }
    } else {
      stack.state._command.done = false
    }

    if(stack.renderGrid) stack.renderGrid() 

    //If child fire, we must take heed that the current "on" middleware function
    //which fired the command must now be marked as complete to avoid
    //it being called again:
    if(newCommand.parent) {
       //only if there is actually middleware (ie- middlewareless fire): 
      if(!stack.state._command.middleware_done && stack.state._command.matching_route.middleware) {
        stack.state._command.matching_route.middleware[stack.state._command.current_middleware_index].done = true
        //(TODO: consider implication of multiple fires within a middleware function;
        //the above functionality may have unexpected implications)  
      }    
    }
    return waterfall(newCommand)
  }
  if(!stack.state._command) return
  //state._command.done = true  
  stack.state._command.middleware_done = true 
  if(stack.renderGrid) stack.renderGrid()

  if(stack.state._command.parent && stack.state._command.parent.children_awaiting) stack.state._command.parent.children_awaiting--

//possily here is calling nextCommand but not making note that 
  
  if(stack.state._command.done) return stack.next()

  //If there is a parent - return and continue where it left off:
  if(stack.state._command.parent && !stack.state._command.parent.done ) {
    //Make a copy and then overwrite the state._command with the parent command.       
    //var newCommand = _.clone(state._command.parent)
    //state._command = state._command.parent 
    //Make sure we run the callback before switching context to the parent command: 
    if(stack.state._command.callback && !stack.state._command.callback_invoked) {
      var nextFire = (callback) => { 
        //_.defer(() => {
          
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
      stack.state._command.callback_invoked = true
      //stack.state._command.callback_underway = true 
      //debugger
      //return _.defer(() => {
        return stack.state._command.callback()
      //})
    } else {
      //return stack.state._command.next(null, stack.state)
      stack.state._command.done = true
      if(stack.renderGrid) stack.renderGrid()
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

  if(state._command.callback && !state._command.callback_invoked ) {
      //if(state._command.done) return nextCommand()
    var nextFire = (callback) => {
      //if(callback) stack(callback) //This queues a given function to the middleware of the
        //current running command: 
        //I think it should be non destructive... ie- run it after the command... is done. 
      if(stack.state._command.done) return //< This should never happen...
      console.log('all done (with callback)')  
      stack.state._command.done = true
      if(callback) callback() //< This type of callback must be synchronous!
      if(stack.renderGrid) stack.renderGrid()  
      if(siblingCommand) {
        console.log('run sibling command...')
        return waterfall(siblingCommand)
      } else { //Even if no sibling from before, it is possible a new sibling 
        //has occurred so we run fand() it should figure it out: 
        console.log('no siblings found, try nextCommand()')
        return stack.next()
      }
    }
    stack.state._command.callback_invoked = true
    return state._command.callback(null, stack.state, nextFire)
  } else {
    state._command.done = true      
    console.log('all done (no callback)') 
    if(stack.renderGrid) stack.renderGrid()    
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
    if(stack.renderGrid) stack.renderGrid()
    if(!command.done && command.callback) {
      if(command.parent && !command.parent.done) {
        //if(command.children) 
        //invoke command for any children with incomplete middleware... 
        debugger
        return stack.next()
      } else {
        //children? find them: 
        var child = _.find(stack.grid.enties, (enty) => enty.command.parent && enty.command.parent.path == command.path && !enty.command.done)
        if(child) child = child.command //< (if child is undefined it would throw err)
        //now assess the children... ie- are they done or no ? 
        debugger
        if(child && _.isUndefined( child.middleware_done)) {
          return waterfall(child)
        }
        //otherwise just end the stack: 
        return endWaterfall()
      }
    } else {
      return console.log('okay maybe nothing else left to do!')
    }
  }
  //If we already at the end of the middleware - just end it: 
  if(command.current_middleware_index == command.matching_route.middleware.length || command.current_middleware_index == command.matching_route.middleware.length) return endWaterfall()

  //is there still a callback to run? 
  //if(command.callback)

  //hack up the remaining middleware; only middleware that isn't already done: 
  var middlewareToRun = _.reject(command.matching_route.middleware, (entry) => entry.done)

  var seedFunction = function(next) { 
    //stack.state._command.current_middleware_index = 0 
    next(null, state)
  }
  middlewareToRun.unshift({func: seedFunction})

  var middlewareToReallyRun = []
  middlewareToRun.forEach((entry, index) => {
    //Capture next: 
    var middlewareFunc = _l.overArgs(entry.func, (stateOrNext) => {
      if(!_.isFunction(stateOrNext)) return stateOrNext
      //If it's not a function, it is the state object: 
      if(stack.state._command) stack.state._command.next = stateOrNext 
      return stateOrNext          
    })
    middlewareToReallyRun.push(middlewareFunc)
    var bufferFunction = (state, next) => {
      if(_.isFunction(state)) next = state
      //Mark middleware as complete: 
    
      //unless all middleware is already complete...
      if(_.every(stack.state._command.matching_route.middleware, (entry) => entry.done)) {
        stack.state._command.middleware_done = true
        return stack.state._command.next()
      }
      //debugger
      if(stack.state._command.current_middleware_index) {
        if(stack.state._command.matching_route.middleware[stack.state._command.current_middleware_index]) {
          stack.state._command.matching_route.middleware[stack.state._command.current_middleware_index].done = true    
          stack.state._command.current_middleware_index++
          return stack.state._command.next()  
        } else {
          console.log('omg edge case!!')
          return
        }       
      } else {
        console.log('edge case!')
        debugger
        return
        //means the command has not been waterfalled yet; ie- it was a sibling who 
        //got queued - so waterfall it now: 
        //console.log('fresh command ${stack.state._command.path} was in queue, waterfalling...')
        //return waterfall()
      }
    }
    middlewareToReallyRun.push(bufferFunction)
    return
  })


  async.waterfall(middlewareToReallyRun, (err, state) => {
    if(err) return console.log(err)
    console.log('all done everything!')  
    return endWaterfall()
  })

    // console.log('all done everything!')  
    // return endWaterfall()

  //state._command = null 
   

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

stack.next = (syncFunc) => {
  
  if(syncFunc) syncFunc()

  //Determine if the current command has a 'next' property
  //in which case, it should invoke that... 
  //ie- instead of stack.next() performing a live analyzation of the grid
  //we should instead be referring to the stack.state._command 
  //which will have a predetermined instrunction/function for what to do next
  //(ie- what command to run next)

  //the other strategy is to just re-enforce this logic to better prevent
  //a command from executing when we are still waiting for some async something...

  if(!stack.state._command) return

  //If all the middleware is complete, make note of it now: 
  if(_.every(stack.state._command.matching_route.middleware, (entry) => entry.done)) {
    if(!stack.state._command.middleware_done) stack.state._command.middleware_done = true
  }

  if(stack.state._command.middleware_done) {
    //We are now likely running the command's callback...
    if(!stack.state._command.callback_invoked) {
      //invoke the command's callback (by running endWaterffall) 
      return endWaterfall()
    } else {
      //the command's callback has already been invoked, so the command is over
      //(however, to guard against this executing multiple times additional logic may be necessary)
      //ONLY if the function that called stack.next() is 
      //the callback
      //this is critical... 
      debugger
      stack.state._command.done = true  
      //we need to wait to make sure the current stack.next() being executed 
      //is the one from the callback and not another command.... 
      if(stack.renderGrid) stack.renderGrid()
    }
  } else {
    //there are still remaining middleware to run: 

    //if(_.every(stack.state._command.matching_route.middleware, (entry) => entry.done) 
    if(stack.state._command.matching_route.middleware[stack.state._command.current_middleware_index]) {
      stack.state._command.matching_route.middleware[stack.state._command.current_middleware_index].done = true
      stack.state._command.current_middleware_index++
    } else {
      //may want to return here; this might mean there is nothing left to do
      console.log('whaaa another edge case!') 
    }

    debugger

    //^ This ensures we increment to the next middleware in the stack: 
    return resumeWaterfall(stack.state._command)
  }

  //Otherwise, current command already done; determine the next command to run.... 
  var incompleteCommands = _.filter( stack.grid.enties, (enty) => !enty.command.done && !enty.command.middleware_done)

  //Still one more command:  
  var seriouslyIncompleteCommands = _.filter( stack.grid.enties, (enty) => !enty.command.done)
  if(seriouslyIncompleteCommands.length) {
    //if(_.filter( stack.grid.enties, (enty) => !enty.command.done))
    var seriouslyIncompleteCommand = _.last(seriouslyIncompleteCommands).command
    if(seriouslyIncompleteCommand.middleware_done && seriouslyIncompleteCommand.callback_invoked && seriouslyIncompleteCommand.children_awaiting == 0) {
      //wtf do we do here...
      //edge case!
      //mark it as done?
      seriouslyIncompleteCommand.done = true
      if(stack.renderGrid) stack.renderGrid()
      return 
    } else {
      //does it have a callback? 
      if(seriouslyIncompleteCommand.callback && !seriouslyIncompleteCommand.callback_invoked) {
        //endWaterfall() will invoke it: 
        ///return endWaterfall(seriouslyIncompleteCommand)
        //it might be a fresh command...
        if(_.isUndefined(seriouslyIncompleteCommand.current_middleware_index)) {
          return waterfall(seriouslyIncompleteCommand)
        } else {
          return resumeWaterfall(seriouslyIncompleteCommand)
        } 
      } else {
        console.log('whoa edge case!')
        debugger
      }
    }
  }

  //start with the last one... 
  if(!incompleteCommands || _.isEmpty(incompleteCommands)) {
    console.log('okay really all done now')

    stack.state._command = null
    return
  }
  
  var lastIncompleteCommand = _.last(incompleteCommands).command

  if(!lastIncompleteCommand) return console.log('like really really really all done now')
  
  console.log('resumeWaterfall (lastIncompleteCommand)')
  return resumeWaterfall( lastIncompleteCommand )
  //this is causing loop I think 
}


module.exports = stack
