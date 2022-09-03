const { log, warn } = console

const routeParser = require('route-parser')
const { find, isFunction, isString, 
  isNull, filter, clone, map, chain, 
  value, isBoolean, merge } = require('lodash') 
const fnArgs = require('function-arguments')

const prefixPath = path => 
  path.substr(0, 1) != '/' ? '/' + path : path 

const stack = {}
let listeners = []

stack.on = (...params) => {
  log('stack.on') 
  const path = prefixPath(params[0]) //< ensure prefixed with '/'
  const func = find(params, (param) => isFunction(param))
  const onceOnly = find(params, param => isBoolean(param))

  //Establish a listener obj...
  let listener = {
    path : path,
    //create a route from the path:
    route : new routeParser(path)
  }  
  if(func) { //(generally a func is included)
    listener.func = func
    listener.args = fnArgs(func)       
    //todo: determine if async... 
    //but i guess if it returns a promise it is
    //cud accommodate the next argument as first param too... 
  }
  
  if(onceOnly) listener.onceOnly = true

  listeners.push(listener) 
}

stack.fire = async (...params) => 
  await new Promise( async r => {
  log('stack.fire') 
  let path = find(params, param => isString(param))
  const callback = find( params, param => isFunction(param) )
  
  if(!path) path = Date.now().toString() //< create a one off
  path = prefixPath(path)

  //create a command
  let command = { path : path, params : null }      

  //is there a callback?  add it now as a listener
  if(callback) {
    command.callback = callback
    stack.on(path, callback, true)
  }    

  //find matching listeners:
  const matchedListeners = filter(listeners, 
    listener => {
    let match = listener.route.match(path)
    //resulting match is an object containing params,
    //so collect them now...
    if(match) { //make object if not already...
      if(isNull(command.params)) command.params = {}
      command.params = merge(command.params, match)
    }
    return match
  }).map(
    listener => clone(listener))
  //^ clone them so we do not mutate the original       
  
  //mutate the root listener list to remove any
  //onceOnly listeners we matched just now:
  listeners = chain(listeners)
    .map(listener => listener.onceOnly ? false : listener)
    .compact().value()                                     

  //loop! 
  await loop(command, matchedListeners) 
  r() 
})


const loop = async (command, matchedListeners) => 
  await new Promise( async r => {
  log('loop')
  for(const listener of listeners) {
    await listener.func()
  }
  r()
})

module.exports = stack
