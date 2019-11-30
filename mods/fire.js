const _ = require('underscore')

module.exports = (stack) => {
  stack.fire = (path, callback, dontRun) => {
    //create a command
    let command = { path : path }
    if(callback) command.callback = callback

    //find matching listeners
    let matchedListeners = _.filter(stack.listeners, (listener) => listener.route.match(path))

    //clone them so we do not mutate the original:
    command.listener_instances = _.map(matchedListeners, (listener) => _.clone(listener))

    //sort them based on priority:
    command.listener_instances = _.sortBy(command.listener_instances, (listener) => listener.priority)

    //### Buffer feature ###
    //if there is a buffer listener, we need to take that one and 'buffer' it between all other listeners
    //ie- so the buffer runs before and after every listener in this chain...
    if(stack.buffer_func) {
      let listenerInstancesBuffered = []
      command.listener_instances.forEach(listener => {
        let bufferListener =
        listenerInstancesBuffered.push(  { func : stack.buffer_func } )
        listenerInstancesBuffered.push(listener)
      })
      command.listener_instances = listenerInstancesBuffered
    }

    //queue command:
    stack.queue.push(command)

    //if dontRun flag is provided or a command is already in progress
    //put the command into queue so it can be run later (and return the command itself)
    if(dontRun) return command

    //otherwise feed into stack.loop:
    stack.loop(command, () => {
      stack.queue.shift() //< remove the command from queue
      if(callback) return callback()
    })
  }

  stack.load = (path, callback) => stack.fire(path,callback,true)
}