const async = require('async')
const _ = require('underscore')

module.exports = (stack) => {
  stack.loop = (command, callback) => {
    async.eachSeries(command.listener_instances, (listenerInstance, eachSeriesCallback) => {
      if(listenerInstance.async) {
        eachSeriesCallback.fire = (path) => stack.fire(path, eachSeriesCallback )
        return listenerInstance.func(eachSeriesCallback)
      }
      //otherwise it's a sync function so just run it and call eachCallback immediately:
      listenerInstance.func()
      return eachSeriesCallback()
    }, () => {
      callback()
    })
  }
}