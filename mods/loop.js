const async = require('async')

module.exports = (stack) => {
  stack.loop = (command, loopCallback) => {
    async.eachSeries(command.listener_instances, (listenerInstance, eachCallback) => {
      //do stuff here
      listenerInstance.func()
      eachCallback()
    }, () => {
      if(command.callback) return command.callback()
      loopCallback()
    })
    //return.... ?
  }
}