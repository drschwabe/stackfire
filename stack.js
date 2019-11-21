// #### STACKFIRE4 ####

const async = require('async')

const stack = {
  commands : [], //< list of commands invoked via stack.fire
  params : {}, //reference to the params of the live command/listener in progress
  //this is updated when the live command changes; ie- column change
  listeners : [],
  queue : []
}

//### stack.on
//Establishes a listener that will wait in stack.listeners until it is matched and then queued into a command via stack.fire
require('./mods/on.js')(stack)

//### stack.fire
//establishes a new command instance and fires the appropriate chain of sorted listeners, asynchronously.
require('./mods/fire.js')(stack)


//### stack.match
//matches listeners to a given pattern; returns all matching listeners; called by stack.fire
stack.match

//### stack.sort

//### stack.loop
require('./mods/loop.js')(stack)


require('./mods/grid.js')(stack)


stack.path = () => {
  //determine the current path based on current model of the grid and the data model; not by checking properties
  //(ie- not much state is saved so we try to determine this in a way that doesnt require it to be set expelicity)
  if(stack.queue.length) return stack.queue[0].path
  return null
}


stack.parentCommand = () => {
  //shortcut to access the parent command of current command/listener in progress. ex:
  //stack.parentCommand().params.body
}

module.exports = stack