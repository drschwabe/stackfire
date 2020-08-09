const async = require('async')
const _ = require('underscore')



module.exports = (stack) => {

  const concludingListener = eachSeriesCallback => {
    stack.command.complete = true
    stack.queue = _.without(stack.queue, stack.command)
    stack.utils.forEach((util) => util('stack.fire_completed', stack.command))
    stack.command = eachSeriesCallback.command //< set this reference back to original parent command
    stack.next = eachSeriesCallback
    eachSeriesCallback()
  }

  stack.loop = (command, callback) => {
    stack.command = command
    if(command.parentListener && command.parentListener.fireEaching) return
    //^ fireEaching manages its own loop
    stack.utils.forEach((util) => util('stack.loop_started', command))
    async.eachSeries(command.listener_instances, (listenerInstance, eachSeriesCallback) => {
      stack.next = eachSeriesCallback //< makes it possible to invoke next listener outside of the listener
      stack.utils.forEach((util) => util('stack.listener_invoked', listenerInstance))

      eachSeriesCallback.command = command
      eachSeriesCallback.end = () => {
        stack.utils.forEach((util) => util('next.end_invoked', listenerInstance))
        eachSeriesCallback(true) //< exit the loop early
      }
      eachSeriesCallback.fire = (...params) => {
        stack.utils.forEach((util) => util('next.fire_invoked', listenerInstance))
        let concludingListenerWithCallback = _.partial( concludingListener, eachSeriesCallback )
        concludingListenerWithCallback.concluding_listener = true
        stack.fire(...params, { parent_listener : listenerInstance }, concludingListenerWithCallback)
      }

      eachSeriesCallback.fireEach = (list, pathFunc, fireEachCallback) => {
        command.fireEaching = true
        //list, command (with context ie: 'delete/ + list.item.uniqueId), callback 
        async.eachSeries(list, (listItem, fireEachSeriesCallback) => {
          fireEachSeriesCallback.command = command
          let path = pathFunc(listItem)
          let concludingListenerWithCallback = _.partial( concludingListener, fireEachSeriesCallback )
          console.log(stack.params())
          stack.fire(path, { parent_listener : listenerInstance }, concludingListenerWithCallback)
        }, () => {
          console.log('reached end of eachSeriesCallback.fireEach')
          command.fireEaching = false
          fireEachCallback()
        })
      }

      //also accommodate for wrapped functions..
      stack.wrapped.forEach( wrappedFuncOrLibFunc => {
        let functionToWrap
        let stackPath
        let key = _.keys(wrappedFuncOrLibFunc)[0]
        let isLib = false
        if( _.isFunction(wrappedFuncOrLibFunc[key]) ) {
          //not an object; just a named function ie: stop()
          functionToWrap = wrappedFuncOrLibFunc
          stackPath =  _.keys(wrappedFuncOrLibFunc)[0]
        } else {
          isLib = true
          //object func, ie: cars.stop()
          stackPath = wrappedFuncOrLibFunc[key].stackPath
          functionToWrap = wrappedFuncOrLibFunc[key][wrappedFuncOrLibFunc[key].funcName]
        }

        let wrappedFunc = _.wrap( functionToWrap,  (func, ...params) => {
          stack.utils.forEach((util) => util('next.fire_invoked', listenerInstance))
          stack.fire(stackPath, ...params,  { parent_listener : listenerInstance }, () => {
            //TODO: use concludingListener /  concludingListenerWithCallback tek as the other .fire above.
            console.log('next fired wrapped function')
            stack.command.complete = true
            stack.queue = _.without(stack.queue, stack.command)
            stack.utils.forEach((util) => util('stack.fire_completed', stack.command))
            stack.command = eachSeriesCallback.command //< set this reference back to original parent command
            stack.next = eachSeriesCallback
            eachSeriesCallback()
          })
        })

        //extend 'next.fire' with this function, using a nested obj if it was supplied as a library:
        if(isLib) {
          eachSeriesCallback.fire[key] = {
            [wrappedFuncOrLibFunc[key].funcName] : wrappedFunc
          }
        } else {
          eachSeriesCallback.fire = _.extend( eachSeriesCallback.fire, { [stackPath] : wrappedFunc  })
        }
      })

      if(listenerInstance.async || listenerInstance.func.wrapped) {
        if(stack.pausing) {
          stack.next = () => listenerInstance.func(eachSeriesCallback)
          return
        }
        if(command.body) {
          return listenerInstance.func( (err, body) => {
            if(err) return console.error(err)
            if(body) command.body = body
            eachSeriesCallback()
          })
        } else {
          return listenerInstance.func(eachSeriesCallback)
        }
      }
      //it's a sync function ...
      if(stack.pausing) { //but if we are pausing a sync func,
        stack.next = () => { //this unpause func will call...
          let listenerResult = listenerInstance.func() //< the sync func...
          if(listenerResult) command.body = listenerResult
          eachSeriesCallback() //< and the async callback immediately after...
        }//to advance the loop!
        return
      }
      //otherwise just run them now..
      //if the function is not a utility...
      let listenerResult = listenerInstance.func()
      if(listenerResult) command.body = listenerResult
      //^ capture the result and if existing apply it as the new body
      if(listenerInstance.func.concluding_listener) return //< the listener will call the eachSeriesCallback()
      return eachSeriesCallback()
    }, () => {
      if( command.parentListener && !command.parentListener.command.fireEaching) {
        //^ do not restore command to parent yet while fireEaching; that loop needs to complete first.
        stack.command = command.parentListener.command
      } else if(command.parentListener && command.parentListener.command.fireEaching) {
        console.log('not existing loop yet; still fireEaching...')
        return //< do not callback yet; the fireEaching loop must finish first. 
      }
      callback()
    })
  }
}
