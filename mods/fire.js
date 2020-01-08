const _ = require('underscore')
const prefixPath = require('../mods/prefix-path.js')

module.exports = (stack) => {
  stack.fire = (path, ...params) => {

    let callback = _.find( params, param => _.isFunction(param) )
    body = _.find(params, param => param != path && param != callback)

    path = prefixPath(path)

    //create a command
    let command = { path : path, body : body }

    //is there a callback?  add it now as a listener
    if(callback) { //note: dupe code from on.js; consider condensing into a single 'create listener' func
      command.callback = callback
      stack.on(path, callback, 601, true)
    }

    command.params = null

    //find matching listeners:
    let matchedListeners = _.filter(stack.listeners, (listener) => {
      let match = listener.route.match(path)
      //resulting match is an object containing params, so collect them now...
      if(match) { //make object if not already...
        if(_.isNull(command.params)) command.params = {}
        command.params = _.extend(command.params, match)
      }
      //and return if there was a match or not for filter criteria:
      return match
    })

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

    //otherwise feed into stack.loop:
    stack.loop(command, () => {
      stack.queue = _.without(stack.queue, command)
      stack.utils.forEach((util) => util('stack.fire_completed', command))
    })
  }

  stack.load = (path, callback) => stack.fire(path,callback,true)
}