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

  const arrangeListeners = (command) => {
    //Prepare the grid / queue listener for this command: 
    column = _.indexOf(stack.commands, command)

    command.listeners.forEach((listener, index) => { 

      //Expand the grid if necessary: 
      if(column >= stack.grid.width) {
        stack.grid = gg.expandGrid(stack.grid)
        stack.grid = gg.populateCells(stack.grid)  
        if(browser) window.renderGrid()      
      }

      var cell 

      if(index === 0 && stack.state.row === 0) cell = gg.xyToIndex(stack.grid, [0, column])
      else cell = gg.nextCellSouth(stack.grid,  gg.xyToIndex(stack.grid, [stack.state.row, column]))

      //Create a grid enty containing the command, cell, and the listener's unique function:  
      var listenerEnty  = { command:  command, cell : cell, func: listener.func }
      stack.grid = gg.insertEnty(stack.grid, listenerEnty)

      //Expand grid to accommodate for the next coming listener/enty:
      if( index != command.listeners.length -1 ) {
        //(only if this is not the last listener in the list)
        stack.grid = gg.expandGrid(stack.grid) 
      }

      //Populate cells of the grid: 
      stack.grid = gg.populateCells(stack.grid)     

      //Set this last because the listenerEnty's cell has been updated 
      //with the expansion: 
      stack.state.row = gg.indexToXy(stack.grid, listenerEnty.cell)[0]

      //#debugging: render the grid if we using browser: 
      if(browser) window.renderGrid()
    })    
  }

  const gridLoop = () => {
    //Loop over each cell and execute the function it now contains: 
    async.each(stack.grid.cells, (cell, callback) => {
      stack.state.cell = cell    
      if( _.indexOf(stack.grid.cells, cell) < 0) return callback()  
      cell.num = _.indexOf(stack.grid.cells, cell)              
      if(!cell.enties.length || cell.enties[0].done) return callback()
      var thisColumnsCells = gg.columnCells(stack.grid, column)
      if(!_.contains(thisColumnsCells, cell.num)) return callback() 
      stack.state.row = gg.indexToXy(stack.grid, cell.num -1)[0]
      cell.enties[0].underway = true  
      if(browser) window.renderGrid()  
      cell.enties[0].func()
      delete cell.enties[0].underway      
      cell.enties[0].done = true  
      //Note this does not yet accommodate for async! 
      if(browser) window.renderGrid()  
      callback()
    }, () => {

      //Find any incomplete listeners (listeners that were queued before an earlier
      //listener up the column fired a new command): 
      var incompleteListeners = _.filter(stack.grid.enties, (enty) => !enty.done)

      //If there is a listener underway; let this async.each call complete
      //(that listenr will then mark itself done and then return back here
      //(not exactly sure why but that's how async deals with this situation))
      if(_.findWhere( incompleteListeners, { underway : true })) {
        matchingCommand.done = true  //< make the matchingCommand done. 
        if(browser) window.renderGrid()   
        return   
      }

      //otherwise - we need to start the loop again so those commands get done
      //(without firing again cause they were already in a command that got fired originally)      
      if(incompleteListeners.length) {
        debugger
        arrangeListeners(incompleteListeners[0].command)
        gridLoop() 
        return
      }
      
      //Reset path and complete the matching command:  
      stack.state.path = null 
      matchingCommand.done = true
      if(browser) window.renderGrid()         
    })
  }

  arrangeListeners(matchingCommand)

  gridLoop() 
}

const prefixPath = (path) => path.substr(0, 1) != '/' ? '/' + path : path

module.exports = stack
