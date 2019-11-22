const async = require('async')

module.exports = (stack) => {
  stack.loop = (command, callback) => {
    async.eachSeries(command.listener_instances, (listenerInstance, eachCallback) => {
      if(listenerInstance.async) {
        return listenerInstance.func(eachCallback)
      } //otherwise it's a sync function so:
      listenerInstance.func()
      return eachCallback()
    }, () => {
      callback()
    })
  }
}