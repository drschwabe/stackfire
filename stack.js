// #### STACK 3 ####

const async = require('async'), 
    routeParser = require('route-parser')
    _ = require('underscore'), 
    gg = require('gg'), 
    fnArgs = require('function-arguments') 

var browser //< Variable to indicate if we running in Node or browser: 
require('detect-node') ? browser = false : browser = true

const stack = {
  state : {}, 
  commands : [],
  queue : [], 
  grid : gg.populateCells(gg.createGrid(1,1)), 
  utils : [] //< For third party mods to execute at each hook
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
  const newListener = { func : callback, path: path }   

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

stack.state.row = 0

stack.fire = (pathname, callback) => {  


  if(!_.isString(pathname)) return console.error('path is not a string')

  //TODO: some better logic to prevent 'rapid fires'; fires interrupting other fires
  
  //IF a sibling fire (not a parent) is underway and NOT finished, 
  //this needs to be queued - or put in a different queue...

  //might need another 'pre grid loop logic' here or 
  //a 'rehearsal' grid layout/assignment at this point

  //or just move up the grid layout assingment stuff before changing stack.state.path here:

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
  }

  //^ Just run the callback if there are no listeners
  //(note this is lazy in that it doesn't register the command to the grid but probably OK)

  //Determine if this is a new instance of the command....
  if(matchingCommand.done) {
    console.log('do not "do" another command...')
    //create a new copy, this time with a uid...
    //matchingCommand = clone(matchingCommand)
    matchingCommand = _.clone(matchingCommand) 
    matchingCommand.listeners = _.without(matchingCommand.listeners, (listener => listener.one_time))
    matchingCommand._id = _.uniqueId() + Date.now()
    matchingCommand.done = false
    stack.commands.push(matchingCommand)
  }


  if(callback) { //If a callback was supplied, add it to the end of this command's listeners: 
    //but only if it has not already been added:
    if(_.last( matchingCommand.listeners ).func.toString() != callback.toString() ) {
      matchingCommand.listeners.push({ func : callback, path: pathname, one_time : true }) 
    }
  } //TODO ^ check if the above is necessary; new ue of one_time may 
  //make this part of the code unnecessary/never run 

  //Pre-grid modification check to see if this command should be queued or not: 
  //if there is a path active: 

  var callee = arguments.callee, 
      caller
        
  if(arguments.callee.caller) caller = arguments.callee.caller.toString()    
  matchingCommand.caller = caller 
  matchingCommand.callee = callee


  var commandToRunNow

  if(!_.isNull(stack.state.path) && stack.grid.enties.length) {

    //determine if matchingCommand has been called from the current command's column, 
    //in which case - we should run it now:
    var liveListener = _.find(stack.grid.enties, (enty) => enty.underway)     
    var liveCommand = _.find(stack.grid.enties, (enty) => enty.underway).command 
    //might want to update this to also facto rin column; to ensure we are choosing
    //from rightmost such that multiple underway listeners don't interferer here
    //if(matchingCommand.callee == liveCommand.callee) {
    if(!liveListener.async) {
      commandToRunNow = matchingCommand
      // if(matchingCommand.callee == liveListener.callee) {
      //   debugger
      // }

      //if the command is async, we wait - otherwise, run now: 
      //i think callee and caller need to be on the listeners; not the command
      //seems like all commands may share the same callee ? 
    } else if(liveListener.async && stack.next_firing) {
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

  //and now begin modifying state of stack; and the grid: 
  delete commandToRun.queued

  stack.next = null //< null this to ensure stack.next is not called from 
  //synchronous callbacks that have a nested stack.fire call

  //Store the parameters, which are included as part of the result of route.match
  //we did previously: 
  stack.state.params = commandToRun.route.match(commandToRun.route.spec)

  stack.state.path = commandToRun.route.spec
  
  var column 

  const initGridWithListeners = (command) => {

    //Prepare the grid / queue listener callbacks for this command...

    //find the leftmost available cell: 
    column = gg.nextOpenColumn(stack.grid, 0)

    command.listeners.forEach((listener, index) => { 

      //Do a pre grid expansion if necessary: 
      if( _.isNaN(column) || column >= stack.grid.width || gg.someEntyIsOnBottomEdge(stack.grid) ) {        
        stack.grid = gg.expandGrid(stack.grid)
        stack.grid = gg.populateCells(stack.grid)  
        if(browser && window.renderGrid) window.renderGrid()
        if(_.isNaN(column)) column = gg.nextOpenColumn(stack.grid, 0) 
        //^ If there wasn't already an open column, now we have one.   
      }

      command.column = column

      var cell 

      var nextCellSouth = gg.nextCellSouth(stack.grid,  gg.xyToIndex(stack.grid, [stack.state.row, column]))

      var nextCell

      //nextCellSouth may not be valid; we may need to subtract the state.row by one if command still in prog
      //but need to make sure this doesnt' fuck up test complex 1 which already works
      //(and find out why it works)

      if(index === 0 && stack.state.row === 0) { 
        //(this is a first callback of a first row command)
        cell = gg.xyToIndex(stack.grid, [0, column])
      } else if(index == 0) { //< this is first callback of a queud (fired) command
        cell = gg.xyToIndex(stack.grid, [stack.state.row, column] )
      } else {
        cell = nextCellSouth
      } 

      //Create a grid enty containing the command, cell, and the listener's unique function:  
      var listenerEnty  = { command:  command, cell : cell, func: listener.func }
      stack.grid = gg.insertEnty(stack.grid, listenerEnty)
   
      //Populate cells of the grid: 
      stack.grid = gg.populateCells(stack.grid)     

      //Set this last because the listenerEnty's cell has been updated 
      //with the expansion: 
      stack.state.row = gg.indexToXy(stack.grid, listenerEnty.cell)[0]

      //#debugging: render the grid if we using browser: 
      if(browser && window.renderGrid) window.renderGrid()
    })    
  }

  const gridLoop = (startCell) => {
    //Loop over each cell and execute the function it now contains: 

    async.eachSeries(stack.grid.cells, (cell, callback) => {
      if(cell < startCell) return callback() 
      stack.state.cell = cell    
      if( _.indexOf(stack.grid.cells, cell) < 0) return callback()  
      cell.num = _.indexOf(stack.grid.cells, cell)  
      if(!cell.enties.length || cell.enties[0].done) return callback()
      var thisColumnsCells = gg.columnCells(stack.grid, column)
      if(!_.contains(thisColumnsCells, cell.num)) return callback() 
      //debugger
      if(cell.enties[0].underway) {  //If its already underway, mark as done: 
        delete cell.enties[0].underway  
        cell.enties[0].done = true
        if(browser && window.renderGrid) window.renderGrid()
        return callback()           
      }
      //check the neighboor; we need to make sure nothing is there 
      var nextCellEast = gg.examine( stack.grid,  gg.nextCellEast(stack.grid, cell.num) ) 
      if(nextCellEast) { 
        //If there is, an updateGridColumn / re-arrangement is required: 
        updateGridColumn(cell.enties[0].command, column)
        gridLoop() //< and restart the gridLoop (TODO: implement a startCell so we could start
        //back here)
        return 
      } 
      // else if(gg.isRightEdge(stack.grid, cell.num)) {
      //   console.log('may need to do expansion here! ')
      // }
      stack.state.row = gg.indexToXy(stack.grid, cell.num)[0]      
      cell.enties[0].underway = true  
      if(browser && window.renderGrid) window.renderGrid()  

      //needs to happen after the listener's callback is executed: 

      //if func has 'next' we assume this is an async... 

      var callee = arguments.callee, 
          caller
          
      if(arguments.callee.caller) caller = arguments.callee.caller.toString()    
      cell.enties[0].caller = caller 
      cell.enties[0].callee = callee

      var entyFuncArgs = fnArgs( cell.enties[0].func  ) 
      if( entyFuncArgs.length ) cell.enties[0].async = true  

      //for now, just make them all async
      stack.next = _.wrap( callback, (callbackFunc, optionalNext) => {
        delete cell.enties[0].underway      
        cell.enties[0].done = true  
        if(browser && window.renderGrid) window.renderGrid()  


        var allCallbacksDone = _.chain(stack.grid.enties)
             .filter((enty) => enty.command.route.spec == cell.enties[0].command.route.spec)
             .every((enty) => enty.done)
             .value() 

        if(allCallbacksDone) cell.enties[0].command.done = true 

        //Note this does not yet accommodate for async! 
        if(browser && window.renderGrid) window.renderGrid()  

        //possibly we will run any queued commands at this point... 
        if(cell.enties[0].async) stack.async_nexting = true      
        if(optionalNext) {
          stack.optional_next = true 
          return callbackFunc(optionalNext)
        }
        return callbackFunc()
      })

      stack.next.fire = (path, callback) => {
        console.log('we are firing from within stack.next.fire: ' + path )       
        debugger  
        stack.next_firing = true 
        if(callback) return stack.fire(path, callback)
        stack.fire(path)
      }
      cell.enties[0].func(stack.next) //< Execute the function! (synchronously)
 
      //Wait for stack.next to be called, unless the user did not supply it
      //Ie- usage is: stack.on(next, function) //< wait for next (async)
      //stack.on(function) //< don't wait for next (synchronous) 
      if(!entyFuncArgs.length && stack.next) stack.next()
      //callback()
    }, () => {
      //this runs x number of times gridLoop (async.series specfically) 
      //is called, so the logic needs to return early unless... 

      //we find any incomplete listeners (listeners that were queued before an earlier
      //listener up the column fired a new command): 
      var incompleteListeners = _.filter(stack.grid.enties, (enty) => {
        return !enty.done && gg.column(stack.grid, enty.cell) == column
      })

      if(!incompleteListeners.length) {
        //if no incomplete listeners, exit the loop.... 
        //first reset path and complete the matching command:  
        stack.state.path = null 
        commandToRun.done = true
        //reset the row back to 0
        stack.state.row = 0
        if(browser && window.renderGrid) window.renderGrid()

        //is there a callback underway? If so, it is the parent of this command; so 
        //we just complete it and then move on... 

        var parentListener = _.filter(stack.grid.enties, { underway: true }).reverse()[0]
        if(parentListener) {
          delete parentListener.underway
          parentListener.done = true 
          column = gg.column(stack.grid, parentListener.cell)
          if(browser && window.renderGrid) window.renderGrid()
          //remaining listeners? 
          var remainingCommandListeners = _.filter(stack.grid.enties, (listener) => {
            return listener.command.route.spec == parentListener.command.route.spec && !listener.done
          })
          if(remainingCommandListeners.length) {
            stack.state.path = remainingCommandListeners[0].command.route.spec            
            updateGridColumn(remainingCommandListeners[0].command, column)
            gridLoop()
          } 
          parentListener.command.done = true 
          if(browser && window.renderGrid) window.renderGrid()
          //if parentListener is done, we still need to check other commands.. 
          if(column > 0) column--; 
          gridLoop() 
          if(!stack.queue.length) return
          return runCommand( stack.queue.pop() )  
        } else {
          _.findWhere(stack.commands, { column : column }).done = true 
          if(browser && window.renderGrid) window.renderGrid()

          //Are there any commands queued? 
          if(!stack.queue.length) return
          return runCommand( stack.queue.pop() ) 
        }
        if(!stack.queue.length) return
        return runCommand( stack.queue.pop() ) 
      }

      //run the incomplete listener/callback by calling gridLoop again...
      //first, update the path:
      stack.state.path = _.find( stack.grid.enties, (enty) => gg.column(stack.grid, enty.cell) == column)
        .command.route.spec

      updateGridColumn(incompleteListeners[0].command)
      gridLoop()
      if(!stack.queue.length) return
      return runCommand( stack.queue.pop() )       
    })
  }

  const updateGridColumn = (command, column) => {
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

    command.listeners.forEach((listener, index) => {  
      var thisColumnEnties = gg.columnEnties(stack.grid, [0, column])  
      var liveListener = _.find(thisColumnEnties, (enty) => {
        var match = enty.command.route.spec == listener.path && listener.func == enty.func
        return match
      })
      if(!liveListener) return console.log('no liveListener!?')
      if(liveListener.done) return

      var nextOccupiedCellEast =  gg.nextOccupiedCellEast(stack.grid, liveListener.cell )
      //Any occupied cells to the east? 
      //or listeners that share this same row... 

      //before checking East, determine if there is already been a shift...

      if(nextOccupiedCellEast) {
        var loopCount = 0
        var findNextValidRow = (startCell) => {
          //find the next row down which is not occupied with cells from another command... 
          var nextOpenRow = gg.nextOpenRow(stack.grid, startCell)

          if(!nextOpenRow) { //expand the grid: 
            //convert startCell to xy so it can convert to the new grid : 
            var startCellRC = gg.indexToXy(stack.grid, startCell)
            stack.grid = gg.expandGrid(stack.grid)
            stack.grid = gg.populateCells(stack.grid)  
            if(browser && window.renderGrid) window.renderGrid()  
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

          var nextRowValid = _.every(nextRowCells, (cell) => {
            var enty = gg.examine(stack.grid, cell)
            if(enty) { //if this enty is of the same command, its OK 
              //(cause it will get pushed down too)
              if(enty.command == command) return true
              if(enty.command.done && gg.indexToXy(stack.grid, enty.cell)[1] <  gg.indexToXy(stack.grid, startCell)[1]) return true 
              else return false
            } else {
              return true 
            }
          })
          if(nextRowValid) {
            //find all commands in this column... 
            var columnCells = gg.columnCells(stack.grid, liveListener.cell ) 
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
              console.log('possible grid expansion is necessary?')


              var currentRow = gg.indexToXy( stack.grid, liveListener.cell )[0]

              console.log('listener index: ' + index)
              console.log('currentRow: ' + currentRow)
              console.log('entiesToMove: ' + entiesToMove.length)
              console.log('nextOpenRow: ' + nextOpenRow)
              console.log('current grid height: ' + stack.grid.height)

              console.log('currentRow + entiestoMove.length: ' + (currentRow + entiesToMove.length))
              console.log('currentRow + nextOpenRow + entiestoMove.length: ' + (currentRow + nextOpenRow + entiesToMove.length))
              console.log('(nextOpenRow - currentRow) + entiesToMove.length: ' + ((nextOpenRow - currentRow) + entiesToMove.length))

              debugger        
              if( (nextOpenRow - currentRow) + entiesToMove.length >= stack.grid.height ) {

              //if( currentRow + entiesToMove.length + nextOpenRow 
              //if( currentRow + index + entiesToMove.length + nextOpenRow >= stack.grid.height )  {

                var newRowsNeeded = currentRow + entiesToMove.length

                //now expand the grid to meet that criteria
                //keep in mind this is executing PER listener... 
                debugger

                _.range(newRowsNeeded).forEach(() => {
                  stack.grid = gg.expandGrid(stack.grid)
                  stack.grid = gg.populateCells(stack.grid)              
                })

                // stack.grid = gg.expandGrid(stack.grid)
                // stack.grid = gg.populateCells(stack.grid) 

                if(browser && window.renderGrid) window.renderGrid()

                debugger 

              }

            }

            //Move the enties:
            entiesToMove.forEach((enty, index) => {
              var commandCell = _.findWhere(stack.grid.enties, { command:  command }).cell
              var targetColumn = gg.indexToXy(stack.grid, commandCell)[1]
              var targetRow = gg.indexToXy(stack.grid, nextRowCells[0])[0]  
              enty.cell =  gg.xyToIndex( stack.grid, [targetRow  + index, targetColumn])
            })
            stack.grid = gg.populateCells(stack.grid)
            if(browser && window.renderGrid) window.renderGrid()
          } else {
            loopCount++ 
            console.log('checking next row...')
            findNextValidRow(liveListener.cell + (loopCount * stack.grid.width))
          }
        }
        findNextValidRow(liveListener.cell) 
      }
    })
    stack.grid = gg.populateCells(stack.grid)
    stack.grid = gg.xyCells(stack.grid) //< make sure all cells are xY'ed    
    if(browser && window.renderGrid) window.renderGrid()
  }

  initGridWithListeners(commandToRun)

  gridLoop()

  const liveListener = () => _.find(stack.grid.enties, (enty) => enty.underway)     
  const liveCommand = () => liveListener().command    
}

const prefixPath = (path) => path.substr(0, 1) != '/' ? '/' + path : path

module.exports = stack
