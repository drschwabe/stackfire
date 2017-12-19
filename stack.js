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
  grid : gg.createGrid(1,1), 
  utils : [] //< For third party mods
}

//Middleware creation function: 
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

  //Either way, we will create a middleware entry;  
  //with two properties: an async handler function 
  //(which calls a callback) and the raw path...
  const newMiddleware = { func : callback, path: path }   

  if(!existingCommand) {
    //No existing command, so let's define one now, 
    //with two properties: the route and an array to store middleware...
    let command = { route: route, middleware: [newMiddleware] }
    stack.commands.push(command)
  } else {
    //If the command already exists, just push this new
    //middleware into the command's existing stack: 
    existingCommand.middleware.push(newMiddleware)
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
  
  //Prepare the grid / queue middleware for this command: 
  var lastInsertedCell = 0
  matchingCommand.middleware.forEach((middleware, index) => { 
    if(index === 0) cell = 0
    else cell = gg.nextCellSouth(stack.grid, lastInsertedCell)

    //Create a grid enty containing the command, cell, and the middleware's unique function:  
    var middlewareEnty  = { command:  matchingCommand, cell : cell, func: middleware.func }
    stack.grid = gg.insertEnty(stack.grid, middlewareEnty)

    //Expand grid to accommodate for the next coming middleware/enty:
    if( index != matchingCommand.middleware.length -1 ) {
      //(only if this is not the last middleware in the list)
      stack.grid = gg.expandGrid(stack.grid) 
    }

    //Populate cells of the grid: 
    stack.grid = gg.populateCells(stack.grid)     

    //Set this last because the middlewareEnty's cell has been updated 
    //with the expansion: 
    lastInsertedCell = middlewareEnty.cell

    //#debugging: render the grid if we using browser: 
    if(browser) window.renderGrid()
  })



  //Loop over each cell and execute the function it now contains: 
  async.each(stack.grid.cells, (cell, callback) => {
    if(!cell.enties.length) return callback()
    cell.enties[0].func()
    cell.enties[0].command.complete = true
    callback()
  }, () => {
    //Reset path: 
    stack.state.path = null    
  })
}

const prefixPath = (path) => path.substr(0, 1) != '/' ? '/' + path : path

module.exports = stack
