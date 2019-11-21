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

    //return command
    stack.queue.push(command)

    //if queue flag is provided or a command is already in progress, put the command into queue so it can be run later (and return the command itself)
    if(dontRun) return command

    //otherwise feed into stack.loop:
    stack.loop(command, () => {
      stack.queue = _.without(stack.queue, command)
    })
  }

  stack.load = (path, callback) => stack.fire(path,callback,true)
}