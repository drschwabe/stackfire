const _ = require('underscore')
const routeParser = require('route-parser')
const fnArgs = require('function-arguments')

module.exports = (stack) => {

  stack.on = (...params) => {

    let path = params[0]
    let func = _.find(params, (param) => _.isFunction(param))
    let priority = _.find(params, (param) => _.isNumber(param))

    //Establish a listener obj...
    let listener = {
      path : path,
      //create a route from the path:
      route : new routeParser(path)
    }

    if(func) { //(generally a func is included)
      listener.func = func
      let listenerFuncArgs = fnArgs(func)
      if(listenerFuncArgs.length) {
        //if the function was supplied with a 'next' argument it is async:
        listener.async = true
        listener.args = listenerFuncArgs
      }
    }

    if(priority) listener.priority = priority

    stack.listeners.push(listener)
    stack.utils.forEach((util) => util('stack.on_completed', listener))
    return listener
  }

  stack.first = (...params) => stack.nth(...params, 1)
  stack.second = (...params) => stack.nth(...params, 2)
  stack.third = (...params) => stack.nth(...params, 3)
  stack.fourth = (...params) => stack.nth(...params, 4)
  stack.fifth = (...params) => stack.nth(...params, 5)
  stack.sixth = (...params) => stack.nth(...params, 6)

  stack.nth = (...params) => stack.on(...params)
}