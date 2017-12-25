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

stack.fire = (path) => {  

  stack.state.path = prefixPath(path)

  //Prepare the new command object: 
  const matchingCommand = _.find(stack.commands, (command) => {
    return command.route.match(stack.state.path)
  })

  if(!matchingCommand) return
  
  //Prepare the grid / queue listener for this command: 
  var lastInsertedRow = 0
  var column = _.indexOf(stack.commands, matchingCommand)

  matchingCommand.listeners.forEach((listener, index) => { 
    //Expand the grid if necessary: 
    if(column >= stack.grid.width) {
      stack.grid = gg.expandGrid(stack.grid)
      stack.grid = gg.populateCells(stack.grid)  
      if(browser) window.renderGrid()      
    }

    var cell 
    if(index === 0) cell = gg.xyToIndex(stack.grid, [0, column])
    else cell = gg.nextCellSouth(stack.grid,  gg.xyToIndex(stack.grid, [lastInsertedRow, column]))

    //Create a grid enty containing the command, cell, and the listener's unique function:  
    var listenerEnty  = { command:  matchingCommand, cell : cell, func: listener.func }
    stack.grid = gg.insertEnty(stack.grid, listenerEnty)

    //Expand grid to accommodate for the next coming listener/enty:
    if( index != matchingCommand.listeners.length -1 ) {
      //(only if this is not the last listener in the list)
      stack.grid = gg.expandGrid(stack.grid) 
    }

    //Populate cells of the grid: 
    stack.grid = gg.populateCells(stack.grid)     

    //Set this last because the listenerEnty's cell has been updated 
    //with the expansion: 
    lastInsertedRow = gg.indexToXy(stack.grid, listenerEnty.cell)[0]

    //#debugging: render the grid if we using browser: 
    if(browser) window.renderGrid()
  })


  //Loop over each cell and execute the function it now contains: 
  async.each(stack.grid.cells, (cell, callback) => {
    if(!cell.enties.length || cell.enties[0].done) return callback()
    var cellNum = _.indexOf(stack.grid.cells, cell)
    var thisColumnsCells = gg.columnCells(stack.grid, column)
    if(!_.contains(thisColumnsCells, cellNum)) return callback() 
    cell.enties[0].underway = true  
    if(browser) window.renderGrid()      
    cell.enties[0].func()
    delete cell.enties[0].underway      
    cell.enties[0].done = true  //Note this does not yet accommodate for 
    //async...  
    if(browser) window.renderGrid()    
    callback()
  }, () => {
    //Reset path: 
    stack.state.path = null 
    matchingCommand.done = true 
    if(browser) window.renderGrid()
    //Reset the state of functions (note we will need a way to 
    //ensure this command can get fired again from within another command on the same loop)
  })
}

const prefixPath = (path) => path.substr(0, 1) != '/' ? '/' + path : path

module.exports = stack
