//accommodate for environment without console: 
//(ex: Quickjs without os module imported) 
let log, warn 
if(console) {
  log = console.log
  warn = console.warn
} else {
  log = warn = () => null 
}

const routeParser = require('route-parser')
const { find, isFunction, isString, 
  isNull, filter, clone, map, chain, 
  value, isBoolean, isArray,  merge, isObject } = require('lodash') 
const _ = require('underscore')
const fnArgs = require('function-arguments')
const isAsyncFn = require('is-async-function') 

const prefixPath = path => 
  path.substr(0, 1) != '/' ? '/' + path : path 

const stack = {}
let listeners = []

let command 

stack.on = (...params) => {
  if(isArray(params[0])) {
    return params[0].forEach( path => 
      stack.on(path, ..._.rest( params ))
    )
  }   
  //log('stack.on') 
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
  let path = find(params, param => isString(param))
  const callback = find( params, param => isFunction(param))
  let body = find(params, param => isObject(param))  
  if(!body) body = find(params, param => param !== path 
    && isString(param))  
  
  if(!path) path = Date.now().toString() //< create a one off
  path = prefixPath(path) 

  //create a command
  let newCommand = { path : path, params : null, body }      

  //is there a callback?  add it now as a listener
  if(callback) {
    newCommand.callback = callback
    stack.on(path, callback, true)
  }    

  //find matching listeners:
  const matchedListeners = filter(listeners, 
    listener => {
    let match = listener.route.match(path)
    //resulting match is an object containing params,
    //so collect them now...
    if(match) { //make object if not already...
      if(isNull(newCommand.params)) newCommand.params = {}
      newCommand.params = merge(newCommand.params, match)
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
  if(looping) {
    return fireQ.push({ command: newCommand, matchedListeners }) 
  }
  command = newCommand //< set the active command
  await loop(command, matchedListeners) 

  while(fireQ.length) {
    let nextCommandSet = fireQ.shift()
    command = nextCommandSet.command 
    await loop(nextCommandSet.command, nextCommandSet.matchedListeners) 
    command = null 
  }
  r() 
})


const fireQ = [] 
let looping = false 
const loop = async (command, matchedListeners) => 
  await new Promise( async r => {
  await stackUtil('fire_started', command )    
  looping = true 
  for(const listener of matchedListeners) {
    await stackUtil('listener_invoked', command)     
    if(isAsyncFn(listener.func)) {
      await listener.func()
    } else {
      listener.func() 
    }
  }
  await stackUtil('fire_complete', command)     
  looping = false 
  r()
})              

stack.flush = () => 
  listeners = [] //< empty listener array 


// Utility events; linear array of
// fns that can be added by internal/external mods
stack.utils = []
const stackUtil = (eventName, detail) => 
  new Promise( async (r) => {
    for await (const util of stack.utils) {
      await util(eventName, detail)      
    }
    r() 
  }) 

//Stock utility event 'logUtil': 
const logUtil = require('./mods/log-util.js') 
//to be called in the context of your app after
//instantiating a new stack: 
stack.logUtil = () => {
  stack.utils.push(logUtil) 
}

//Proxy to ensure we get the live command result for 
//body, params, and path (when calling stack.body, etc) 
const proxiedStack = new Proxy(stack, {
  get(target, property) {
    if (property === 'body') {
      let body = () => command.body 
      return body()  
    }
    if (property === 'params') {
      let params = () => command.params 
      return params()  
    }  
    if (property === 'path') {
      let path = () => command.path
      return path()  
    } 
    return target[property]
  }
})         

module.exports = proxiedStack 
