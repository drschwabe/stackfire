const _ = require('underscore')
routeParser = require('route-parser')

module.exports = (stack) => {

  stack.on = (...params) => {

    let path = params[0]
    let func = params[1]

    //Establish a listener obj...
    let listener = {
      path : path,
      func : func,
      //create a route from the path:
      route : new routeParser(path)
    }
    return listener
  }
}

