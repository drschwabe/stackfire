const _ = require('underscore')
const prefixPath = require('../mods/prefix-path.js')
const async = require('async')
const fnArgs = require('function-arguments')

module.exports = (stack) => {
  stack.fire = (path, ...params) => {

    let callback = _.find( params, param => _.isFunction(param) )
    let parentListenerObj = _.find(params, param => _.isObject(param) && param.parent_listener )
    let body = _.find(params, param => param != path && param != callback)

    path = prefixPath(path)

    //create a command
    let command = { path : path, body : body }
    if(parentListenerObj) command.parentListener = parentListenerObj.parent_listener

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
      if(!listener.priority) listener.priority = _.indexOf(command.listener_instances, listener) + 100
      listener.command = command //< convenient reference to parent command
      return listener
    })
    //### Buffer feature ###
    //if there is a buffer listener, we need to take that one and 'buffer' it between all other listeners
    //ie- so the buffer runs before and after every listener in this chain...
    if(stack.buffer_func) {
      //determine if its async or not:
      let bufferFuncArgs = fnArgs(stack.buffer_func)
      let bufferListener = {
        func : stack.buffer_func,
        buffer : true
      }
      if(bufferFuncArgs.length) {
        //if the function was supplied with a 'next' argument it is async:
        bufferListener.async = true
        bufferListener.args = bufferFuncArgs
      }
      //TODO: this is 2nd place where doing this same fnArgs and async stamping; make it a re-usable

      let listenerInstancesBuffered = []

      command.listener_instances.forEach((listener, index) => {
        if(listener.priority == 601) {
          //do not buffer the trailing callback:
          listenerInstancesBuffered.push(listener)
          return
        }
        let bufferListenerBefore = _.clone( bufferListener )
        bufferListenerBefore.priority = listener.priority - 1
        bufferListenerBefore.command = listener.command
        let bufferListenerAfter =  _.clone( bufferListener )
        bufferListenerAfter.priority = listener.priority + 1
        bufferListenerAfter.command = listener.command

        if(index === 0) {
          listenerInstancesBuffered.push(bufferListenerBefore) //< buffer before
        }
        listenerInstancesBuffered.push(listener)
        listenerInstancesBuffered.push(bufferListenerAfter) //< buffer after
      })
      command.listener_instances = listenerInstancesBuffered
    }

    //sort them based on priority:
    command.listener_instances = _.sortBy(command.listener_instances, (listener) => listener.priority)

    //queue command:
    stack.queue.push(command)

    //determine if we need to wait for current command to finish...
    //OR if we need to immediately invoke a new loop...

    if(!command.parentListener && stack.queue.length > 1) return //< if there is already a command in queue, wait unles...
    if(command.parentListener) { //< if the command has a parent listener, don't wait - loop now:
      return stack.loop(command, () => {
        stack.queue = _.without(stack.queue, command)
        stack.utils.forEach((util) => util('stack.fire_completed', command))
        //probably need to proceed to the async.whilst below at this point
        //ie- via an async.eachSeries
      })
    }

    //otherwise proceed...

    //feed into stack.loop, wrapped in a async.whilst so that we run
    //the loop for as long as necessary to crunch all the commands in queue
    //(this allows subsequent stack.fires to occur without interrupting
    //an in-progress fire already invoked)
    async.whilst(
      () => stack.queue.length,
      (callback) => {
        let commandToRun = stack.queue[0]
        stack.loop(commandToRun, () => {
          stack.queue = _.without(stack.queue, commandToRun)
          stack.utils.forEach((util) => util('stack.fire_completed', commandToRun))
          callback()
        })
      }
    )
  }

  stack.load = (path, callback) => stack.fire(path,callback,true)
}