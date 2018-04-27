// #### STACK 3 ####

const async = require('async'), 
    routeParser = require('route-parser')
    _ = require('underscore'), 
    gg = require('gg')

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

stack.fire = (path) => {  

  stack.state.path = prefixPath(path)

  //Prepare the new command object: 
  const matchingCommand = _.find(stack.commands, (command) => {
    return command.route.match(stack.state.path)
  })

  if(!matchingCommand) return
  
  var column 

  const initGridWithListeners = (command) => {
    //Prepare the grid / queue listener for this command: 
    column = _.indexOf(stack.commands, command)

    command.listeners.forEach((listener, index) => { 

      //Do a pre grid expansion if necessary: 
      if(column >= stack.grid.width || gg.anyColumnIsFull(stack.grid) ) {        
        stack.grid = gg.expandGrid(stack.grid)
        stack.grid = gg.populateCells(stack.grid)  
        if(browser && window.renderGrid) window.renderGrid()      
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

  const gridLoop = () => {
    //Loop over each cell and execute the function it now contains: 
    async.eachSeries(stack.grid.cells, (cell, callback) => {
      stack.state.cell = cell    
      if( _.indexOf(stack.grid.cells, cell) < 0) return callback()  
      cell.num = _.indexOf(stack.grid.cells, cell)  
      if(!cell.enties.length || cell.enties[0].done) return callback()
      var thisColumnsCells = gg.columnCells(stack.grid, column)
      if(!_.contains(thisColumnsCells, cell.num)) return callback() 
      stack.state.row = gg.indexToXy(stack.grid, cell.num)[0]      
      cell.enties[0].underway = true  
      if(browser && window.renderGrid) window.renderGrid()  
      cell.enties[0].func()
      delete cell.enties[0].underway      
      cell.enties[0].done = true  
      //Note this does not yet accommodate for async! 
      if(browser && window.renderGrid) window.renderGrid()  
      callback()
    }, () => {

      //Find any incomplete listeners (listeners that were queued before an earlier
      //listener up the column fired a new command): 
      var incompleteListeners = _.filter(stack.grid.enties, (enty) => !enty.done)

      //If there is a listener underway; let this async.each call complete
      //(that listenr will then mark itself done and then return back here...
      //not exactly sure why but that's how async deals with this situation)
      if(_.findWhere( incompleteListeners, { underway : true })) {
        matchingCommand.done = true  //< make the matchingCommand done. 
        if(browser && window.renderGrid) window.renderGrid()   
        return   
      }

      //otherwise - we need to start the loop again so those commands get done
      //(without firing again cause they were already in a command that got fired originally)      
      if(incompleteListeners.length) {
        updateGridColumn(incompleteListeners[0].command)
        gridLoop()
        return
      }
      
      //Reset path and complete the matching command:  
      stack.state.path = null 
      matchingCommand.done = true
      if(browser && window.renderGrid) window.renderGrid()         
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

          var nextRow = gg.nextRow(stack.grid, startCell)

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
