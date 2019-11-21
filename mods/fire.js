const _ = require('underscore')

module.exports = (stack) => {
  stack.fire = (path, callback) => {
    //create a command
    let command = { path : path }
    if(callback) command.callback = callback

    //find matching listeners
    let matchedListeners = _.filter(stack.listeners, (listener) => listener.route.match(path))

    //clone them so we do not mutate the original:
    command.listener_instances = _.map(matchedListeners, (listener) => _.clone(listener))

    stack.queue.push(command)

    stack.loop(command, () => {
      stack.queue = _.without(stack.queue, command)
    })
  }
}