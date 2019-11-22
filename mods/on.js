const _ = require('underscore')
const routeParser = require('route-parser')
const fnArgs = require('function-arguments')

module.exports = (stack) => {

  stack.on = (...params) => {

    let path = params[0]
    let func = params[1]

    //Establish a listener obj...
    let listener = {
      path : path,
      //create a route from the path:
      route : new routeParser(path)
    }

    if(func) { //(generally a func is included)
      listener.func = func
      //if the function was supplied with a 'next' argument it is async:
      listener.async = fnArgs(func).length ?  true : false
    }

    stack.listeners.push(listener)

    return listener
  }
}

