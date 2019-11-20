// #### STACKFIRE4 ####

const async = require('async')
const gg = require('gamegrids')

const stack = {
  commands : [], //< list of commands invoked via stack.fire
  params : {}, //reference to the params of the live command/listener in progress
  //this is updated when the live command changes; ie- column change
  listeners : [],
  grid : gg.populateCells(gg.createGrid(1,1))
}

//### stack.on
//Establishes a listener that will wait in stack.listeners until it is matched and then queued into a command via stack.fire
require('./mods/on.js')(stack)

//### stack.fire
//establishes a new command instance and fires the appropriate chain of sorted listeners, asynchronously.
//require('./mods/fire.js')

//### stack.match
//matches listeners to a given pattern; returns all matching listeners; called by stack.fire
stack.match

//### stack.sort



stack.parentCommand = () => {
  //shortcut to access the parent command of current command/listener in progress. ex:
  //stack.parentCommand().params.body
}

module.exports = stack