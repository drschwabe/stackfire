const async = require('async')

module.exports = (stack) => {
  stack.loop = (command, callback) => {

    async.eachSeries(command.listener_instances, (listenerInstance, eachCallback) => {
      listenerInstance.func()
      eachCallback()
    }, () => {
      callback()
    })
  }
}