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
  value, isBoolean, isArray,  merge, 
  isObject, last } = require('lodash') 
const { rest } = require('underscore') 
const fnArgs = require('function-arguments')
const isAsyncFn = require('is-async-function') 

let crypto
//NodeJS or client:  
if (typeof window === 'undefined') {           
  crypto = require('crypto')
} else {
  crypto = global.crypto
}

const prefixPath = path => 
  path.substr(0, 1) != '/' ? '/' + path : path 

const stack = {}
let listeners = []
let runningListeners = [] 

let command, currentListener  

stack.on = (...params) => {
  if(isArray(params[0])) {
    return params[0].forEach( path => 
      stack.on(path, ...rest( params ))
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

  listener.id = crypto.randomUUID()  
  listeners.push(listener) 
}

stack.fire = async (...params) => 
  await new Promise( async r => {
  let path = find(params, param => isString(param))
  const callback = find( params, param => isFunction(param))
  let body = find(params, param => isObject(param))  
  if(!body) body = find(params, param => param !== path 
    && isString(param))  
  let branch = find(params, param => isBoolean(param))
  //parent of the branch: 
  let parentListener = find(params, param=> isObject(param) &&
    param.func) 

  if(!path) path = Date.now().toString() //< create a one off
  path = prefixPath(path) 

  //create a command
  let newCommand = { 
    id : crypto.randomUUID(), 
    path : path, params : null, body }      

  if(parentListener) {
    newCommand.parentListenerId = parentListener.id 
  }

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

  let result 
  let parentCommand 
  if(branch) {
    //keep track of parent: 
    newCommand.branch = true 
    newCommand.parentPath = command.path  
    parentCommand = clone(command)  
    command = newCommand
    result = await loop(newCommand, matchedListeners) 
    command = parentCommand 
    newCommand.parentListener = parentListener 
    return r( result )  
  }

  //loop! 
  if(looping) {
    return fireQ.push({ command: newCommand, matchedListeners }) 
  }
  command = newCommand //< set the active command
  result = await loop(command, matchedListeners) 

  while(fireQ.length) {
    let nextCommandSet = fireQ.shift()
    command = nextCommandSet.command 
    result = await loop(nextCommandSet.command, 
      nextCommandSet.matchedListeners) 
    command = null 
  }
  r(result) 
})

stack.branch = async (...params) =>
  await new Promise( async r => {
  //determine the current listener in progress...
  const runningListener = chain(listeners)
      .filter(listener => listener.running) 
      .sortBy('runningStart') 
      .last()
      .value() 
  let result = await stack.fire(...params, true, runningListener) 
  r( result ) 
}) 


const fireQ = [] 
let looping = false 
const loop = async (command, matchedListeners) => 
  await new Promise( async r => {
  await stackUtil('fire_started', command )    
  looping = true 
  for(const listener of matchedListeners) {
    let newBody 
    currentListener = listener 
    let matchingListener = find(listeners, thatListener => 
      thatListener.id === listener.id) 

    matchingListener.running = true 
    matchingListener.runningStart = Date.now() 
    matchingListener.parentCommandId = command.id 

    await stackUtil('listener_invoked',
      { command, listener })     
    if(isAsyncFn(listener.func)) {
      newBody = await listener.func()
    } else {
      newBody = listener.func() 
    }
    if(newBody === false || newBody === null ) {
      command.body = null 
    } else if(newBody) {
      command.body = newBody 
    } 
    //(undefined newBody will not overwrite the command's
    // previous .body value) 
  }
  await stackUtil('fire_complete', command)     
  looping = false 
  r(command.body)
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
