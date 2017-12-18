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

  //matchingCommand.path = path

  //Prepare the commands array into a function we can feed async...
  //hmmmm maybe a forever loop? 
  //ie- async.forever(stack.command)
  //this way is stack.command gets 

  //Determine the cell
  //stack.grid = gg.insertEnty(stack.grid, { command: newCommand, cell : cell })
  //populate the grid with each function... 
  stack.grid = gg.insertEnty(stack.grid, { command:  matchingCommand, cell : 0, func: matchingCommand.middleware[0].func })

  //stack.grid = gg.insertEnty(stack.grid, { command: matchingCommand, cell : 0, })

  gg.populateCells(stack.grid) 

  if(browser) window.renderGrid() 

  //return 

  //simply run the next function in the grid... 
  stack.cell = 0 //< start at 0

  stack.grid.cells[stack.cell].enties[0].func()

  //Reset path: 
  stack.state.path = null
}

const forever = () => {
  async.forever(
    (next) => {
      // next is suitable for passing to things that need a callback(err [, whatever]);
      // it will result in this function being called again.

    },
    (err) => {
      // if next is called with a value in its first parameter, it will appear
      // in here as 'err', and execution will stop.
    }
  )
}

const prefixPath = (path) => path.substr(0, 1) != '/' ? '/' + path : path

module.exports = stack
