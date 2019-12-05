// #### STACKFIRE4 ####

const async = require('async')
const _ = require('underscore')

function Stack() {
  var stack = this
  stack.listeners = []
  stack.queue = []
  //for 'hooking' into stack's internal control flow:
  stack.utils = []

  //### stack.on
  //Establishes a listener that will wait in stack.listeners until it is matched and then queued into a command via stack.fire
  require('./mods/on.js')(stack)

  //### stack.fire
  //establishes a new command instance and fires the appropriate chain of sorted listeners, asynchronously.
  require('./mods/fire.js')(stack)

  //### stack.loop
  require('./mods/loop.js')(stack)
  require('./mods/buffer.js')(stack)

  stack.path = () => {
    //determine the current path based on current model of the grid and the data model; not by checking properties
    //(ie- not much state is saved so we try to determine this in a way that doesnt require it to be set expelicity)
    if(stack.queue.length) return _.last(stack.queue).path
    return null
  }

  stack.parentCommand = () => {
    //shortcut to access the parent command of current command/listener in progress. ex:
    //stack.parentCommand().params.body
  }

}

module.exports = Stack