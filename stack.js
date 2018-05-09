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

stack.fire = (path, callback) => {  
  debugger

  stack.next = null //< null this to ensure stack.next is not called from 
  //synchronous callbacks that have a nested stack.fire call

  if(!_.isString(path)) return console.error('path is not a string')

  stack.state.path = prefixPath(path)

  //check for wildcard *
  //if its a wildcard, we need to add it to a list of wildcards
  //and then for every command, before it runs - we add the wildcard callback
  //this could be at the same point the command's callback is added
  //however, we do want the wildcard to run AT the time it is defined for a given commmand
  //so may have to maintain an extra index


  //Prepare the new command object: 
  var matchedRoute
  var matchingCommand = _.find(stack.commands, (command) => {
    matchedRoute = command.route.match(stack.state.path)
    return matchedRoute
  })

  if(!matchingCommand && !callback) return
  if(!matchingCommand && callback) return callback() 

  //^ Just run the callback if there are no listeners
  //(note this is lazy in that it doesn't register the command to the grid but probably OK)

  //Determine if this is a new instance of the command....
  if(matchingCommand.done) {
    console.log('do not "do" another command...')
    debugger
    //create a new copy, this time with a uid...
    //matchingCommand = clone(matchingCommand)
    matchingCommand = _.clone(matchingCommand)    
    //^ problem... 
    debugger
    matchingCommand._id = _.uniqueId() + Date.now()
    matchingCommand.done = false
    stack.commands.push(matchingCommand)
    debugger
  }



  //Store the parameters, which are included as part of the result of route.match
  //we did previously: 
  stack.state.params = matchedRoute

  if(callback) { //If a callback was supplied, add it to the end of this command's listeners: 
    matchingCommand.listeners.push({ func : callback, path: stack.state.path })  
  }

  //Is this fire from an existing callback already in progress on the grid? 
  debugger  

  
  var column 

  const initGridWithListeners = (command) => {

    //Prepare the grid / queue listener callbacks for this command...

    //find the leftmost available cell: 
    column = gg.nextOpenColumn(stack.grid, 0)
    command.column = column

    command.listeners.forEach((listener, index) => { 

      //Do a pre grid expansion if necessary: 
      if( _.isNaN(column) || column >= stack.grid.width || gg.someEntyIsOnBottomEdge(stack.grid) ) {        
        stack.grid = gg.expandGrid(stack.grid)
        stack.grid = gg.populateCells(stack.grid)  
        if(browser && window.renderGrid) window.renderGrid()
        if(_.isNaN(column)) column = gg.nextOpenColumn(stack.grid, 0) 
        //^ If there wasn't already an open column, now we have one.   
      }

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
      debugger
      var thisColumnsCells = gg.columnCells(stack.grid, column)
      if(!_.contains(thisColumnsCells, cell.num)) return callback() 
      stack.state.row = gg.indexToXy(stack.grid, cell.num)[0]      
      cell.enties[0].underway = true  
      if(browser && window.renderGrid) window.renderGrid()  

      //needs to happen after the listener's callback is executed: 

      //if func has 'next' we assume this is an async... 

      //for now, just make them all async
      stack.next = _.wrap( callback, (callbackFunc) => {
        delete cell.enties[0].underway      
        cell.enties[0].done = true  
        //debugger
        if(browser && window.renderGrid) window.renderGrid()  

        var allCallbacksDone = _.chain(stack.grid.enties)
             .filter((enty) => enty.command.route.spec == cell.enties[0].command.route.spec)
             .every((enty) => enty.done)
             .value() 

        if(allCallbacksDone) cell.enties[0].command.done = true 

        //Note this does not yet accommodate for async! 
        if(browser && window.renderGrid) window.renderGrid()  
        return callbackFunc()
      })

      cell.enties[0].func(stack.next) //< Execute the function! (synchronously)
 
      //Wait for stack.next to be called, unless the user did not supply it
      //Ie- usage is: stack.on(next, function) //< wait for next (async)
      //stack.on(function) //< don't wait for next (synchronous) 
      var entyFuncArgs = fnArgs( cell.enties[0].func  ) 
      if(!entyFuncArgs.length && stack.next) stack.next()
      //callback()
    }, () => {
      debugger
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
        matchingCommand.done = true
        //reset the row back to 0
        stack.state.row = 0
        //stack.commands_completed.push(matchingCommand)
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
            updateGridColumn(remainingCommandListeners[0].command)
            gridLoop()
          } 
          parentListener.command.done = true 
          if(browser && window.renderGrid) window.renderGrid()
          return 
        } else {
          _.findWhere(stack.commands, { column : column }).done = true 
          if(browser && window.renderGrid) window.renderGrid()
          return           
        }
        return 
      }

      //run the incomplete listener/callback by calling gridLoop again...
      //first, update the path:
      stack.state.path = _.find( stack.grid.enties, (enty) => gg.column(stack.grid, enty.cell) == column)
        .command.route.spec

      updateGridColumn(incompleteListeners[0].command)
      gridLoop()
    })
  }

  const updateGridColumn = (command) => {
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
      var liveListener = _.findWhere( stack.grid.enties, {func : listener.func })
      if(liveListener.done) return

      var nextOccupiedCellEast =  gg.nextOccupiedCellEast(stack.grid, liveListener.cell )
      //Any occupied cells to the east? 
      //or listeners that share this same row... 

      //before checking East, determine if there is already been a shift...

      if(nextOccupiedCellEast) {
        var loopCount = 0
        var findNextValidRow = (startCell) => {
          //find the next row down which is not occupied with cells from another command... 
          var nextOpenRow = gg.nextOpenRow(stack.grid, startCell )

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
          var nextRowValid = _.every(nextRowCells, (cell) => {
            var enty = gg.examine(stack.grid, cell)
            if(enty) { //if this enty is of the same command, its OK 
              //(cause it will get pushed down too)
              if(enty.command == command) return true
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

  initGridWithListeners(matchingCommand)

  gridLoop() 
}

const prefixPath = (path) => path.substr(0, 1) != '/' ? '/' + path : path

module.exports = stack
