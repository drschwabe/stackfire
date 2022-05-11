const async = require('async')
const _ = require('underscore')



module.exports = (stack) => {

  const concludingListener = reduceCallback => {
    stack.command.complete = true
    stack.queue = _.without(stack.queue, stack.command)
    stack.utils.forEach((util) => util('stack.fire_completed', stack.command))
    stack.command = reduceCallback.command //< set this reference back to original parent command
    stack.next = reduceCallback
    reduceCallback()
  }

  stack.loop = (command, callback) => {
    stack.command = command
    if(command.parentListener && command.parentListener.fireEaching) return
    //^ fireEaching manages its own loop
    stack.utils.forEach((util) => util('stack.loop_started', command))
    async.reduce(command.listener_instances, {}, (memo, listenerInstance, reduceCallback) => {
      if(!_.isEmpty(memo)) command.body = memo 
      stack.next = reduceCallback //< makes it possible to invoke next listener outside of the listener
      stack.utils.forEach((util) => util('stack.listener_invoked', listenerInstance))

      reduceCallback.command = command
      reduceCallback.body = command.body
      reduceCallback.end = () => {
        stack.utils.forEach((util) => util('next.end_invoked', listenerInstance))
        reduceCallback(true) //< exit the loop early
      }
      reduceCallback.fire = (...params) => {
        stack.utils.forEach((util) => util('next.fire_invoked', listenerInstance))
        let concludingListenerWithCallback = _.partial( concludingListener, reduceCallback )
        concludingListenerWithCallback.concluding_listener = true
        stack.fire(...params, { parent_listener : listenerInstance }, concludingListenerWithCallback)
      }

      reduceCallback.fireEach = (list, pathFunc, fireEachCallback) => {
        command.fireEaching = true
        //list, command (with context ie: 'delete/ + list.item.uniqueId), callback 
        async.eachSeries(list, (listItem, firereduceCallback) => {
          firereduceCallback.command = command
          let path = pathFunc(listItem)
          let concludingListenerWithCallback = _.partial( concludingListener, firereduceCallback )
          console.log(stack.params())
          stack.fire(path, { parent_listener : listenerInstance }, concludingListenerWithCallback)
        }, () => {
          console.log('reached end of reduceCallback.fireEach')
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
            stack.command = reduceCallback.command //< set this reference back to original parent command
            stack.next = reduceCallback
            reduceCallback()
          })
        })

        //extend 'next.fire' with this function, using a nested obj if it was supplied as a library:
        if(isLib) {
          reduceCallback.fire[key] = {
            [wrappedFuncOrLibFunc[key].funcName] : wrappedFunc
          }
        } else {
          reduceCallback.fire = _.extend( reduceCallback.fire, { [stackPath] : wrappedFunc  })
        }
      })

      if(listenerInstance.async || listenerInstance.func.wrapped) {
        if(stack.pausing) {
          stack.next = () => listenerInstance.func(reduceCallback)
          return
        }
        return listenerInstance.func(reduceCallback)
      }
      //it's a sync function ...
      if(stack.pausing) { //but if we are pausing a sync func,
        stack.next = () => { //this unpause func will call...
          let listenerResult = listenerInstance.func() //< the sync func...
          if(listenerResult) command.body = listenerResult
          reduceCallback() //< and the async callback immediately after...
        }//to advance the loop!
        return
      }
      //otherwise just run them now..
      //if the function is not a utility...
      let listenerResult = listenerInstance.func()
      if(listenerResult) command.body = listenerResult
      //^ capture the result and if existing apply it as the new body
      if(listenerInstance.func.concluding_listener) return //< the listener will call the reduceCallback()
      return reduceCallback()
    }, (err) => {
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
