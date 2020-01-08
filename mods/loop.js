const async = require('async')
const _ = require('underscore')

module.exports = (stack) => {
  stack.loop = (command, callback) => {
    stack.utils.forEach((util) => util('stack.loop_started', command))
    async.eachSeries(command.listener_instances, (listenerInstance, eachSeriesCallback) => {
      stack.utils.forEach((util) => util('stack.listener_invoked', listenerInstance))
      if(listenerInstance.async) {
        eachSeriesCallback.end = () => eachSeriesCallback(true) //< exit the loop early
        eachSeriesCallback.fire = (...params) => stack.fire(...params, eachSeriesCallback )
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