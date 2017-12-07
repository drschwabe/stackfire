// #### STACK 3 ####

const async = require('async'), 
    routeParser = require('route-parser')
    _ = require('underscore')

const stack = {
  commands : [],
  queue : [], 
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
    //with hwo properties: the route and an array to store middleware...
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
  path = prefixPath(path)

  //Prepare the new command object: 
  const matchingCommand = _.find(stack.commands, (command) => {
    return command.route.match(path)
  })

  if(!matchingCommand) return

  //Prepare the commands array into a function we can feed async...
  //hmmmm maybe a forever loop? 
  //ie- async.forever(stack.command)
  //this way is stack.command gets 

  //
  gg.insertEnty

  stack.queue.push

  forever()

  //Run the command....
  async.waterfall(matchingCommand.middleware, (middleware, callback) => {
    middleware.func(callback) 
    //visualize this
    //make sure if a command in prog - we never run another one.  
  })

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
