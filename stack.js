// #### STACK 3 ####

//const async = require('neo-async').safe(),
//const async = require('neo-async'), 
var async = require('async'),
    routeParser = require('route-parser'), 
    _ = require('underscore'), 
    gg = require('gg'), 
    fnArgs = require('function-arguments'), 
    uuid = require('uuid')

var browser, electron //< Variable to indicate if we running in Node or browser: 
require('detect-node') ? browser = false : browser = true
require('is-electron') ? electron = true : electron = false 

const stack = {
  state : {}, 
  commands : [],
  queue : [], 
  grid : gg.populateCells(gg.createGrid(1,1)), 
  utils : [],  //< For third party mods to execute at each hook  
  trimming : false //< Do not clear the grid after every command (slower)
}

//Listener creation function:
stack.on = (path, callback) => { 

  //Ensure path always is prefixed with a slash: 
  path = prefixPath(path) 

  //Create a route from the path: 
  let route = new routeParser(path) 

  //Determine if this path corresponds to a command
  //already defined (via a previous stack.on call) in our stack: 
  const existingCommand = _.find(stack.commands, (existingCommand) => {
    return existingCommand.route.match(path)
  })

  //Either way, we will create a listener entry;  
  //with two properties: an async handler function 
  //(which calls a callback) and the raw path...
  const newListener = { func : callback, path: path, _id : uuid.v4()  }   

  if(!existingCommand) {
    //No existing command, so let's define one now, 
    //with two properties: the route and an array to store listeners...
    let command = { route: route, listeners: [newListener] }
    stack.commands.push(command)
  } else {
    //If the command already exists, just push this new
    //listener into the command's existing stack: 
    existingCommand.listeners.push(newListener)
  }

  return
}

stack.once = (pathOrCommand, callback) => {
  var path, route, existingCommand
  if(_.isObject(pathOrCommand)) {
    //console.log('isObject')
    existingCommand = pathOrCommand
    path = existingCommand.route.spec
  } else {
    //console.log('isString')
    path = prefixPath(pathOrCommand)
    route = new routeParser(path) 
    existingCommand = _.find(stack.commands, (existingCommand) => existingCommand.route.match(path))  
  }
  const newListener = { func : callback, path: path, _id : uuid.v4() }   
  newListener.one_time = true //< ...only diff is we set this flag 
  if(!existingCommand) {
    let command = { route: route, listeners: [newListener] }
    stack.commands.push(command)
  } else {
    existingCommand.listeners.push(newListener)
  }
  return  
}

//A listener to execute: 
//stack.every = (pathOrCommand, frequency, priority, callback) => {
//for now just make it on all commands, frequency: command, priority: last 
//(end of every command) 
stack.every = (callback) => {
  stack.commands.forEach((command) => {
    command.listeners.push({
      func: callback, 
      path : command.route.spec, 
      every : true, 
      _id : uuid.v4()
    })
  })
}

stack.buffer = (callback) => {
  stack.commands.forEach((command) => {    
    var listenersWithBuffers = [{
        func: callback, 
        path : command.route.spec, 
        buffer : true, 
        _id : uuid.v4()  
      }]
    command.listeners.forEach((listener) => {
      var bufferListener = {
        func: callback, 
        path : command.route.spec, 
        buffer : true, 
        _id : uuid.v4()  
      }
      listenersWithBuffers.push(listener)
      listenersWithBuffers.push(bufferListener)
    })
    command.listeners = listenersWithBuffers
  })

  // stack.grid.enties.forEach((enty) => {
  //   debugger //Not sure why this hack needed, 
  //   //but ensures that the buffer property is reflected in the grid. 
  //   if(enty.func.toString() == callback.toString()) {
  //     enty.buffer = true 
  //   }
  // })
  //stack.grid = gg.populateCells(stack.grid)
}

stack.endCommand = (next) => { 
 
  var thisColumnsCells = gg.columnCells(stack.grid, stack.column) 
 
  var incompleteListeners = _.chain(thisColumnsCells)
    .map((cell) => {  
      var enty = gg.examine(stack.grid, cell)  
      if(!enty) return false 
      if(!enty.done && gg.column(stack.grid, enty.cell) == stack.column  ) {
        return enty 
      }
      return false 
    })
    .compact() 
    .value()  
 
  if(incompleteListeners.length) {
    incompleteListeners.forEach((listener) => { 
      listener.done = true  
      listener.skipped = true  
    }) 
  }
  if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 

  stack.path = null 

  if(stack.queue.length) runCommand( stack.queue.pop() )  
  return //(otherwise do nothing) 
} 
 


//For now set this as last cause there is no way to determine all listeners.. 
//unless stack.on is updated to check for any stack.every's ? hmmm

stack.row = 0

stack.fire = (pathname, callback) => {  

  if(!_.isString(pathname)) return console.error('path is not a string')

  //TODO: some better logic to prevent 'rapid fires'; fires interrupting other fires
  
  //IF a sibling fire (not a parent) is underway and NOT finished, 
  //this needs to be queued - or put in a different queue...

  //might need another 'pre grid loop logic' here or 
  //a 'rehearsal' grid layout/assignment at this point

  //or just move up the grid layout assingment stuff before changing stack.path here:

  var pathname = prefixPath(pathname)

  //check for wildcard *
  //if its a wildcard, we need to add it to a list of wildcards
  //and then for every command, before it runs - we add the wildcard callback
  //this could be at the same point the command's callback is added
  //however, we do want the wildcard to run AT the time it is defined for a given commmand
  //so may have to maintain an extra index

  //Prepare the new command object: 
  var matchedRoute
  var matchingCommand = _.find(stack.commands, (command) => {
    matchedRoute = command.route.match(pathname)
    return matchedRoute
  })

  if(!matchingCommand && !callback) {
    console.log('there are no listeners (or callback) existing for this command')
    return
  }
  if(!matchingCommand && callback) {
    //make the callback a listener; register it now: 
    stack.on(pathname, callback)
    //now match it: 
    var matchedRoute
    var matchingCommand = _.find(stack.commands, (command) => {
      matchedRoute = command.route.match(pathname)
      return matchedRoute
    })
    //set a flag that this is one_time
    //(do not keep this listener for subsequent fires of the same path)
    matchingCommand.listeners[0].one_time = true 
  } else if(callback) {
    //console.log('run only once')
    stack.once(pathname, callback)
  }

  //Determine if this is a new instance of the command....
  if(matchingCommand.done) {
    //create a new copy, this time with a uid...
    matchingCommand = _.clone(matchingCommand) 
    matchingCommand.listeners = _.chain(matchingCommand.listeners)
      .map(listener => listener.one_time ? false : listener)
      .compact()
      .value() 
    matchingCommand._id = _.uniqueId() + Date.now()
    matchingCommand.done = false
    //add the callback if one was provided: 
    if(callback) stack.once(matchingCommand, callback)
    stack.commands.push(matchingCommand)
  }

  //Pre-grid modification check to see if this command should be queued or not: 
  //if there is a path active: 

  var callee = arguments.callee, 
      caller
        
  if(arguments.callee.caller) caller = arguments.callee.caller.toString()    
  matchingCommand.caller = caller 
  matchingCommand.callee = callee


  var commandToRunNow

  if(!_.isNull(stack.path) && stack.grid.enties.length) {

    //determine if matchingCommand has been called from the current command's column, 
    //in which case - we should run it now:
    //var liveListener = _.find(stack.grid.enties, (enty) => enty.underway)     
    //var liveCommand = _.find(stack.grid.enties, (enty) => enty.underway).command 
    //might want to update this to also facto rin column; to ensure we are choosing
    //from rightmost such that multiple underway listeners don't interferer here
    //if(matchingCommand.callee == liveCommand.callee) {
    if(!liveListener() || !liveListener().async) {
      commandToRunNow = matchingCommand

      //if the command is async, we wait - otherwise, run now: 
      //i think callee and caller need to be on the listeners; not the command
      //seems like all commands may share the same callee ? 
    } else if(liveListener().async && stack.next_firing) {
      commandToRunNow = matchingCommand
      stack.next_firing = false 
      //the only time we fire a command from within an async 
      //listener function in progress is when it is called via 
      //stack.fire.next('command-path')
    } else {
      //if this has been fired within a 'next' we should run it now... 
      
      //it should then be queued, so mark and push it: 
      matchingCommand.queued = true
      stack.queue.push(matchingCommand) 
      return       
    }
  } else if(stack.queue.length) {
    commandToRunNow = stack.queue.pop() 
  } else {
    commandToRunNow = matchingCommand
  }

  return runCommand(commandToRunNow)

}

const runCommand = (commandToRun) => {

  commandToRun.start_time = new Date()

  //console.log('run command: ' + commandToRun.route.spec)

  //and now begin modifying state of stack; and the grid: 
  delete commandToRun.queued

  stack.next = null //< null this to ensure stack.next is not called from 
  //synchronous callbacks that have a nested stack.fire call

  //Store the parameters, which are included as part of the result of route.match
  //we did previously: 
  stack.params = commandToRun.route.match(commandToRun.route.spec)

  stack.path = commandToRun.route.spec
  

  const initGridWithListeners = (command) => {

    //Prepare the grid / queue listener callbacks for this command...

    //Do a pre pre grid expansion if necessary: 
    if( _.isNaN(stack.column) || stack.column >= stack.grid.width || gg.someEntyIsOnBottomEdge(stack.grid )  || gg.someEntyIsOnRightEdge(stack.grid) ) {        
      stack.grid = gg.expandGrid(stack.grid)
      stack.grid = gg.populateCells(stack.grid)  
      if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 
      if(_.isNaN(stack.column)) stack.column = gg.nextOpenColumn(stack.grid, 0) 
      //^ If there wasn't already an open column, now we have one.   
    }

    stack.column = gg.nextOpenColumn(stack.grid, 0)

    command.listeners.forEach((listener, index) => { 

      //Do a pre grid expansion if necessary: 
      if( _.isNaN(stack.column) || stack.column >= stack.grid.width || gg.someEntyIsOnBottomEdge(stack.grid)  || gg.someEntyIsOnRightEdge(stack.grid)) {        
        stack.grid = gg.expandGrid(stack.grid)
        stack.grid = gg.populateCells(stack.grid)  
        if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 
        if(_.isNaN(stack.column)) stack.column = gg.nextOpenColumn(stack.grid, 0) 
        //^ If there wasn't already an open column, now we have one.   
      }

      command.column = stack.column

      var cell 

      var nextCellSouth = gg.nextCellSouth(stack.grid,  gg.xyToIndex(stack.grid, [stack.row, stack.column]))

      var nextCell

      //nextCellSouth may not be valid; we may need to subtract the state.row by one if command still in prog
      //but need to make sure this doesnt' fuck up test complex 1 which already works
      //(and find out why it works)

      if(index === 0 && stack.row === 0) { 
        //(this is a first callback of a first row command)
        cell = gg.xyToIndex(stack.grid, [0, stack.column])
      } else if(index == 0) { //< this is first callback of a queud (fired) command
        cell = gg.xyToIndex(stack.grid, [stack.row, stack.column] )
      } else {
        cell = nextCellSouth
      } 

      //Create a grid enty extending the original listener with cell #
      //(and command... this latter prop may or may not be necessary)
      //var listenerEnty  = _.extend(listener, { command:  command, cell : cell, func: listener.func }) 
      var listenerEnty  = { 
        command:  command, 
        cell : cell, 
        func: listener.func
      }
      //listenerEnty = _.extend(listener, listenerEnty) 
      if(listener.buffer) listenerEnty.buffer = true 
      if(listener.every) listenerEnty.every = true 
      listenerEnty._id = listener._id


      stack.grid = gg.insertEnty(stack.grid, listenerEnty)
   
      //Populate cells of the grid: 
      stack.grid = gg.populateCells(stack.grid)     

      //Set this last because the listenerEnty's cell has been updated 
      //with the expansion: 
      stack.row = gg.indexToXy(stack.grid, listenerEnty.cell)[0]

      //#debugging: render the grid if we using browser: 
      if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 
    })    
  }

  const gridLoop = (startCell) => {

    var cellCount = -1

    var thisColumnsCells = gg.columnCells(stack.grid, stack.column)

    async.eachSeries(thisColumnsCells, (cell, callback) => {

      var cell = stack.grid.cells[cell]

      if(_.isUndefined(cell)) return callback(true)

      cell.num = _.indexOf(stack.grid.cells, cell)  

      if(!cell.enties.length) return callback()
      if(cell < startCell) return callback()
      stack.cell = cell    
      if( _.indexOf(stack.grid.cells, cell) < 0) return callback()   
      if(cell.enties[0].done) return callback () 

      if(cell.enties[0].underway) {  //If its already underway, mark as done: 
        delete cell.enties[0].underway  
        cell.enties[0].done = true
        cell.enties[0].end_time = new Date()
        cell.enties[0].total_time = cell.enties[0].end_time - cell.enties[0].start_time

        if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 
        return callback()           
      }
      //check the neighboor; we need to make sure nothing is there 
      var nextCellEast = gg.examine( stack.grid,  gg.nextCellEast(stack.grid, cell.num) ) 
      if(nextCellEast) { 
        //If there is, an updateGridColumn / re-arrangement is required: 
        updateGridColumn(cell.enties[0].command, stack.column)
        gridLoop() //< and restart the gridLoop (TODO: implement a startCell so we could start
        //back here)
        return 
      } 
      // else if(gg.isRightEdge(stack.grid, cell.num)) {
      //   console.log('may need to do expansion here! ')
      // }
      stack.row = gg.indexToXy(stack.grid, cell.num)[0]      
      cell.enties[0].underway = true  
      if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc())   

      //needs to happen after the listener's callback is executed: 

      //if func has 'next' we assume this is an async... 

      var callee = arguments.callee, 
          caller

      cell.enties[0].callee = callee
      //cell.enties[0].callee_str = callee.toString()

      if(arguments.callee.caller) {
        caller = arguments.callee.caller.toString()
        cell.enties[0].caller = caller                 
      }

      var entyFuncArgs = fnArgs( cell.enties[0].func  ) 
      if( entyFuncArgs.length ) cell.enties[0].async = true  


      cell.enties[0].func_str = cell.enties[0].func.toString() 

      cell.enties[0].test = true


      if(_.isNull(stack.path)) stack.path = cell.enties[0].command.route.spec

      //for now, just make them all async
      stack.next = _.wrap( callback, (callbackFunc, optionalNext) => {
        delete cell.enties[0].underway      
        cell.enties[0].done = true  
        cell.enties[0].end_time = new Date()
        cell.enties[0].total_time = cell.enties[0].end_time - cell.enties[0].start_time        
        if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc())   

        var allCallbacksDone = _.chain(stack.grid.enties)
             .filter((enty) => enty.command.route.spec == cell.enties[0].command.route.spec)
             .every((enty) => enty.done)
             .value() 

        if(allCallbacksDone || _.isNull(stack.path)) {
          cell.enties[0].command.done = true 
          cell.enties[0].command.end_time = new Date()
          cell.enties[0].command.total_time = cell.enties[0].command.end_time - cell.enties[0].command.start_time     
          //if(stack.column > 0) stack.column--           
        }     

        //Note this does not yet accommodate for async! 
        if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc())   

        //possibly we will run any queued commands at this point... 
        if(cell.enties[0].async) {
          //console.log('is async...')
          stack.async_nexting = true   
        }

        if(_.isNull(stack.path)) {
          //console.log('stack.path is null')
          //return null //< no need to call anything further 
          stack.next = null 
          //console.log(callbackFunc)
        }
        if(optionalNext) {
          stack.optional_next = true 
          //console.log('running optional next')
          return callbackFunc(optionalNext)
        }
        if(_.isNull(stack.path)) return null
        return callbackFunc()
      })

      stack.next.fire = (path, callback) => {
        stack.next_firing = true 
        if(callback) return stack.fire(path, callback)
        stack.fire(path)
      }

      //Execute the function!
      cell.enties[0].start_time = new Date()

      // console.log('calling this func:')
      // console.log(cell.enties[0].func)

      if(!cell.enties[0].func) {
        return console.log('something funced happened')
      }

      cell.enties[0].func(stack.next)
      
      //Wait for stack.next to be called, unless the user did not supply it
      //Ie- usage is: stack.on(next, function) //< wait for next (async)
      //stack.on(function) //< don't wait for next (synchronous) 
      
      if(!entyFuncArgs.length && stack.next)  {
        //console.log('calling stack.next()')
        return stack.next()
      }

    }, (returningEarly) => {

      //we find any incomplete listeners (listeners that were queued before an earlier
      //listener up the column fired a new command): 
      var incompleteListeners = _.filter(thisColumnsCells, (cell) => { 
        //console.log('cell is: ' + cell + ' and column is: ' + stack.column) 
        var enty = gg.examine(stack.grid, cell) 
        if(!enty) return false   
        return !enty.done && gg.column(stack.grid, enty.cell) == stack.column
      })

      if(!incompleteListeners.length) {
        //if no incomplete listeners, exit the loop.... 
        //first reset path and complete the matching command:  
        stack.path = null 
        commandToRun.done = true
        commandToRun.end_time = new Date()
        commandToRun.total_time = commandToRun.end_time - commandToRun.start_time      
             
        //reset the row back to 0
        stack.row = 0
        //reset the current column back 
        if(stack.column > 0) stack.column-- 
        if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 

        //is there a callback underway? If so, it is the parent of this command; so 
        //we just complete it and then move on... 

        var parentListener = _.filter(stack.grid.enties, { underway: true }).reverse()[0]
        if(parentListener) {
          delete parentListener.underway
          parentListener.done = true 
          parentListener.end_time = new Date()
          parentListener.total_time = parentListener.end_time - parentListener.start_time      

          stack.column = gg.column(stack.grid, parentListener.cell)
          if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 
          //remaining listeners? 
          var remainingCommandListeners = _.filter(stack.grid.enties, (listener) => {
            return listener.command.route.spec == parentListener.command.route.spec && !listener.done
          })
          if(remainingCommandListeners.length) {
            stack.path = remainingCommandListeners[0].command.route.spec            
            updateGridColumn(remainingCommandListeners[0].command, stack.column)
            gridLoop()
          } 
          parentListener.command.done = true 
          parentListener.command.end_time = new Date()
          parentListener.command.total_time = parentListener.command.end_time - parentListener.command.start_time

          if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 
          //if parentListener is done, we still need to check other commands.. 
          if(stack.column > 0) stack.column--; 
          gridLoop() 
          if(!stack.queue.length) return trimGrid()
          return runCommand( stack.queue.pop() )  
        } else {
          var commandInCurrentColumn = _.findWhere(stack.commands, { column : stack.column })
          if(commandInCurrentColumn) commandInCurrentColumn.done = true 
          if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 

          //Are there any commands queued? 
          if(!stack.queue.length) return trimGrid()
          return runCommand( stack.queue.pop() ) 
        }
        if(!stack.queue.length) return trimGrid()
        return runCommand( stack.queue.pop() ) 
      }

      //run the incomplete listener/callback by calling gridLoop again...
      //first, update the path:
      stack.path = _.find( stack.grid.enties, (enty) => gg.column(stack.grid, enty.cell) == stack.column)
        .command.route.spec

      updateGridColumn(incompleteListeners[0].command)
      gridLoop()
      //these will never run? 
      // if(!stack.queue.length) return trimGrid()
      // return runCommand( stack.queue.pop() )       
    })
  }

  const updateGridColumn = (command, column) => {
    if(!column) column = command.column
    stack.column = column 
    //The 'live' version of this command's listeners are already assigned
    //and in the grid (stack.grid.enties), 
    //the command however is a re-usable 'on the shelf' version; so 
    //we will reference what listeners it has and find them in the live grid, 
    //so we can determine if each listener is done or not
    //(and if not done, we update it's position in the grid to accommodate
    //for sibling commands that increased the depth of the stack...
    //ie: ensure each incomplete listener is pushed to the very bottom of the grid
    //below any sibling commands that were fired after these listeners were
    //originally assigned to the grid)

    command.listeners.every((listener, index) => {  
      var thisColumnEnties = gg.columnEnties(stack.grid, [0, stack.column])  
      var currentListener = _.find(thisColumnEnties, (enty) => { 
        var match = enty._id == listener._id 
        return match 
      })
      if(!currentListener) {
        //console.log('no currentListener!?')
        //maybe moving TOO fast? 
        //var liveListener2 = liveListener() 
        //setTimeout(() => )path

        //TODO: return early from this loop
        
        return false 
      } 
      if(currentListener.done) return true

      var nextOccupiedCellEast =  gg.nextOccupiedCellEast(stack.grid, currentListener.cell )
      //Any occupied cells to the east? 
      //or listeners that share this same row... 

      //before checking East, determine if there is already been a shift...

      if(nextOccupiedCellEast) {
        var loopCount = 0
        var findNextValidRow = (startCell) => {

          //determine how many new rows we need... 
          var columnCells = gg.columnCells(stack.grid, currentListener.cell ) 
          var entiesToMove = []
          var lastCompletedCommandInThisColumn
          columnCells.forEach((cell, index) => {
            var enty = gg.examine(stack.grid, cell)
            if(enty && enty.command && !enty.done) {
              entiesToMove.push(enty)
            }
          })

          //find the next row down which is not occupied with cells from another command... 
          var nextOpenRow = gg.nextOpenRow(stack.grid, startCell + (entiesToMove.length * stack.grid.width))
          //^ accommodate for each enty to move (one new row required)

          if(!nextOpenRow) { //expand the grid: 
           // console.log('do grid expansion')

            //convert startCell to xy so it can convert to the new grid : 
            var startCellRC = gg.indexToXy(stack.grid, startCell)

            _.times(entiesToMove.length + 1, () => {
              stack.grid = gg.expandGrid(stack.grid)
              stack.grid = gg.populateCells(stack.grid)  
              if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc())   
            })

            startCell = gg.xyToIndex(stack.grid, startCellRC)
            nextOpenRow = gg.nextOpenRow(stack.grid, startCell )             
          }

          //var nextRow = gg.nextRow(stack.grid, startCell)

          var nextRowCells = gg.rowCells(stack.grid, startCell + stack.grid.width)

          
          //Is every cell of the next row NOT occupied by a different command? 
          //[x - -]
          //[x y -]
          //[x y -] < invalid
          //[x - -] < valid

          //(also valid is [ z x - - - ] where z is a completed command/listener )

          var nextValidRow 

          stack.grid = gg.rcCells(stack.grid)

          var nextRowValid = _.every(nextRowCells, (cell) => {
            var enty = gg.examine(stack.grid, cell)
            if(enty) { //if this enty is of the same command, its OK 
              //(cause it will get pushed down too)
              if(enty.command == command) {
                nextValidRow = gg.indexToRc(stack.grid, cell)[0]
                return true
              }
              if(!enty.command) {
                //console.log("what the fack")
                return false
              } 
              //I believe this line checks to make sure the column is behind and not ahead... 
              if(enty.command.done) {
                //if this command is done and it is in a previosu column...
                //that is OK: 
                var entyColumn = gg.indexToRc(stack.grid, enty.cell)[0]
                var currentCommandColum = gg.indexToRc(stack.grid, startCell)[1]
                if( currentCommandColum > entyColumn ) {
                  nextValidRow = gg.indexToRc(stack.grid, cell)[0]
                  return true
                }  
                else return false 
              } else {
                return false 
              }
            } else {
              nextValidRow = gg.indexToRc(stack.grid, cell)[0]
              return true 
            }
          })
          if(nextRowValid) {
            //find all commands in this column... 
            var columnCells = gg.columnCells(stack.grid, currentListener.cell ) 
            var entiesToMove = []
            var lastCompletedCommandInThisColumn
            columnCells.forEach((cell, index) => {
              var enty = gg.examine(stack.grid, cell)
              if(enty && enty.command && !enty.done) {
                entiesToMove.push(enty)
              }
            })
            //Before moving the enties, determine if a grid expansion is necessary: 
            if(entiesToMove.length > 1) {
              //determine how many available cells are below the current row: 
              //gg.openCellsDown(stack.grid, gg.index( nextRowCells[0] ) )

              var currentRow = gg.indexToXy( stack.grid, currentListener.cell )[0]
      
              if( (nextOpenRow - currentRow) + entiesToMove.length >= stack.grid.height ) {

              //if( currentRow + entiesToMove.length + nextOpenRow 
              //if( currentRow + index + entiesToMove.length + nextOpenRow >= stack.grid.height )  {

                var newRowsNeeded = currentRow + entiesToMove.length

                //now expand the grid to meet that criteria
                //keep in mind this is executing PER listener... 

                //this necessary I think in some situations if there was no check for 'nextvalid row'
                _.range(newRowsNeeded).forEach(() => {
                  stack.grid = gg.expandGrid(stack.grid)
                  stack.grid = gg.populateCells(stack.grid)              
                })

                //(but disabling for now)

                // stack.grid = gg.expandGrid(stack.grid)
                // stack.grid = gg.populateCells(stack.grid) 

                if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 

              }

            }

            //Move the enties:
            entiesToMove.forEach((enty, index) => {
              var commandCell = _.findWhere(stack.grid.enties, { command:  command }).cell
              var targetColumn = gg.indexToXy(stack.grid, commandCell)[1]
              //var targetRow = gg.indexToXy(stack.grid, nextRowCells[0])[0] 
              enty.cell =  gg.xyToIndex( stack.grid, [nextValidRow  + index, targetColumn])
            })
            stack.grid = gg.populateCells(stack.grid)
            if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc()) 
          } else {
            loopCount++ 
            findNextValidRow(currentListener.cell + (loopCount * stack.grid.width))
          }
        }
        findNextValidRow(currentListener.cell) 
      }
    })
    stack.grid = gg.xyCells(stack.grid) //< make sure all cells are xY'ed    
    if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc())
  }

  initGridWithListeners(commandToRun)

  gridLoop()

}


const liveListener = () => _.find(stack.grid.enties, (enty) => enty.underway)     

const liveCommand = () => liveListener().command    

const prefixPath = (path) => path.substr(0, 1) != '/' ? '/' + path : path

//Trim the grid of all completed commands: 
const trimGrid = (force) => {
  if(!stack.grid.cells[0].enties[0]) return 
  var incompleteListeners = _.filter(stack.grid.enties, (enty) => { 
    return !enty.done && gg.column(stack.grid, enty.cell) == stack.column
  })
  if(incompleteListeners.length && !force) return //< Only trim if force flag is on...
  //ie: do not trim grid if there are incomplete enties cause 
  //this means there could be an async listener underway

  //console.log('total time to complete: ' + stack.grid.cells[0].enties[0].command.route.spec )
  //console.log(stack.grid.cells[0].enties[0].command.total_time)
  if(!force && !stack.trimming) return  
  stack.grid.enties = [] 
  delete stack.grid.cells
  stack.cell = null 
  stack.column = 0 
  stack.row = 0
  stack.path = null 
  delete stack.grid 
  stack.grid = gg.populateCells(gg.createGrid(1,1))
  if(stack.utils.length) stack.utils.forEach((utilFunc) => utilFunc())  
}

stack.trimGrid = trimGrid

var startTime, endTime;

function start() {
  startTime = new Date();
};

function end() {
  endTime = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  timeDiff /= 1000;

  // get seconds 
  var seconds = Math.round(timeDiff);
  //console.log(seconds + " seconds");
}

module.exports = stack
