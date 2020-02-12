const async = require('async')
const _ = require('underscore')

module.exports = (stack) => {
  stack.loop = (command, callback) => {
    stack.command = command
    stack.utils.forEach((util) => util('stack.loop_started', command))
    async.eachSeries(command.listener_instances, (listenerInstance, eachSeriesCallback) => {
      stack.utils.forEach((util) => util('stack.listener_invoked', listenerInstance))
      if(listenerInstance.async ) {
        if(stack.pausing) { //if pausing, the eachSeriesCallback becomes a sort of phantom call...
          eachSeriesCallback = _.wrap(eachSeriesCallback, originalEachSeriesCallback => {
            stack.unpause = originalEachSeriesCallback //< putting the real callback here
          }) //(so that the UI can call this func to advance loop)
        }
        eachSeriesCallback.command = command
        eachSeriesCallback.end = () => eachSeriesCallback(true) //< exit the loop early
        eachSeriesCallback.fire = (...params) => {
          stack.utils.forEach((util) => util('next.fire_invoked', listenerInstance))
          stack.fire(...params, { parent_listener : listenerInstance }, () => {
            stack.command = eachSeriesCallback.command //< set this reference back to original parent command
            eachSeriesCallback()
          })
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
