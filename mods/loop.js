const async = require('async')
const _ = require('underscore')

module.exports = (stack) => {
  stack.loop = (command, callback) => {
    stack.command = command
    stack.utils.forEach((util) => util('stack.loop_started', command))
    async.eachSeries(command.listener_instances, (listenerInstance, eachSeriesCallback) => {
      stack.utils.forEach((util) => util('stack.listener_invoked', listenerInstance))
      if(listenerInstance.async ) {
        eachSeriesCallback.command = command
        eachSeriesCallback.end = () => eachSeriesCallback(true) //< exit the loop early
        eachSeriesCallback.fire = (...params) => {
          stack.utils.forEach((util) => util('next.fire_invoked', listenerInstance))
          stack.fire(...params, { parent_listener : listenerInstance }, eachSeriesCallback )
        }
        return listenerInstance.func(eachSeriesCallback)
      }
      //it's a sync function ...
      if(stack.pausing) { //but if we are pausing a sync func,
        stack.unpause = () => { //this unpause func will call...
          listenerInstance.func() //< the sync func...
          eachSeriesCallback() //< and the async callback immediately after...
        }//to advance the loop!
        return
      }
      //otherwise just run them now:
      listenerInstance.func()
      return eachSeriesCallback()
    }, () => {
      callback()
    })
  }
}