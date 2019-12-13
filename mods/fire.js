const _ = require('underscore')

module.exports = (stack) => {
  stack.fire = (path, callback, dontRun) => {
    //create a command
    let command = { path : path }

    //is there a callback?  add it now as a listener
    if(callback) { //note: dupe code from on.js; consider condensing into a single 'create listener' func
      command.callback = callback
      stack.on(path, callback, 601, true)
    }

    //find matching listeners
    let matchedListeners = _.filter(stack.listeners, (listener) => listener.route.match(path))

    //clone them so we do not mutate the original:
    command.listener_instances = _.map(matchedListeners, (listener) => _.clone(listener))

    //mutate the root listener list to remove any onceOnly listeners we matched just now:
    stack.listeners = _.chain(stack.listeners)
                        .map(listener => listener.onceOnly ? false : listener)
                        .compact().value()

    command.listener_instances = _.map(command.listener_instances, listener => {
      //if a given listener doesn't have a priority; assign it one now:
      if(!listener.priority) listener.priority = _.indexOf(command.listener_instances, listener) + 10
      return listener
    })

    //### Buffer feature ###
    //if there is a buffer listener, we need to take that one and 'buffer' it between all other listeners
    //ie- so the buffer runs before and after every listener in this chain...
    if(stack.buffer_func) {
      let listenerInstancesBuffered = []

      command.listener_instances.forEach(listener => {
        if(listener.priority == 601) {
          //do not buffer the trailing callback:
          listenerInstancesBuffered.push(listener)
          return
        }
        listenerInstancesBuffered.push(  { func : stack.buffer_func, priority : listener.priority - 1 } ) //< buffer before
        listenerInstancesBuffered.push(listener)
        listenerInstancesBuffered.push(  { func : stack.buffer_func,  priority : listener.priority + 1 } ) //< buffer after
      })
      command.listener_instances = listenerInstancesBuffered
    }

    //sort them based on priority:
    command.listener_instances = _.sortBy(command.listener_instances, (listener) => listener.priority)

    //queue command:
    stack.queue.push(command)

    //if dontRun flag is provided or a command is already in progress
    //put the command into queue so it can be run later (and return the command itself)
    if(dontRun) return command

    //otherwise feed into stack.loop:
    stack.loop(command, () => {
      stack.queue.shift() //< remove the command from queue
      stack.utils.forEach((util) => util('stack.fire_completed', command))
    })
  }

  stack.load = (path, callback) => stack.fire(path,callback,true)
}