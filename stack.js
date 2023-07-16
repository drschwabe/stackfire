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
  value, isBoolean, isArray, isNumber, merge, 
  isObject, last, sortBy, indexOf } = require('lodash') 
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
  const priority = find(params, (param) => isNumber(param))

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
  
  if(priority) listener.priority = priority
  if(onceOnly) listener.onceOnly = true

  listener.id = crypto.randomUUID()  
  listeners.push(listener) 
}

stack.last = (...params) => stack.on(...params, 500)

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

  if(body && body._stackfireStore) {
    delete body._stackfireStore
    newCommand.store = clone(body)  
  }

  if(parentListener) {
    newCommand.parentListenerId = parentListener.id 
  }

  //is there a callback?  add it now as a listener
  if(callback) {
    newCommand.callback = callback
    stack.on(path, callback, true)
  }    

  //find matching listeners:
  let matchedListeners = filter(listeners, 
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

  matchedListeners.map( listener => {
    if(!listener.priority) listener.priority =
    indexOf(matchedListeners, listener) + 10
    return listener 
  })
  matchedListeners = sortBy(matchedListeners, 'priority')

  let result 
  let parentCommand 
  if(branch) {
    //keep track of parent: 
    newCommand.branch = true 
    newCommand.parentPath = command.path  
    newCommand.parentCommandId = command.id 
    parentCommand = clone(command)  
    command = newCommand
    result = await loop(newCommand, matchedListeners) 
    command = parentCommand 
    newCommand.parentListener = parentListener 
    return r( result )  
  }

  //loop! 
  let fireQed 
  if(looping) {
    fireQ.push({ command: newCommand, matchedListeners, promise: r }) 
    await stackUtil('fireQ_appended', newCommand )    
    //log('## fireQ: ##') 
    //log(fireQ) 
    fireQed = true 
  } else {
    command = newCommand //< set the active command
    result = await loop(command, matchedListeners)                  
  }
 
  while(!looping && fireQ.length) {
    let nextCommandSet = fireQ.shift()
    command = nextCommandSet.command 
    result = await loop(nextCommandSet.command, 
    nextCommandSet.matchedListeners) 
    nextCommandSet.promise(result) 
  }

  if(!fireQed) r(result) 
})

stack.branch = async (...params) =>
  await new Promise( async r => {
  //determine the current listener in progress...
  const runningListener = chain(listeners)
      .filter(listener => listener.running) 
      .sortBy('runningStart') 
      .last()
      .value() 

  await stackUtil('fire_branch', { path : params[0] }) 
  let result = await stack.fire(...params, true, runningListener) 
  r( result ) 
}) 


const fireQ = [] 
let looping = false 
const loop = async (activeCommand, matchedListeners) => 
  await new Promise( async r => {
  await stackUtil('fire_started', activeCommand )    
  looping = true 
  command = activeCommand
  let doBreak 
  for await (const listener of matchedListeners) {
    let newBody  
    currentListener = listener 
    let matchingListener = find(listeners, thatListener => 
      thatListener.id === listener.id) 

    if(!matchingListener) {
      warn('could not find a matching listener (skipping)') 
      continue
    } 

    matchingListener.running = true 
    matchingListener.runningStart = Date.now() 
    matchingListener.parentCommandId = activeCommand.id 

    await stackUtil('listener_invoked',
      { command: activeCommand, listener : matchingListener })     
    if(isAsyncFn(listener.func)) {
      newBody = await listener.func(activeCommand.body)
    } else {
      newBody = listener.func(activeCommand.body) 
    }
    if(newBody === null ) {
      activeCommand.body = null 
    } else if(newBody === false) {
      //the listener has cancelled the command 
      doBreak = true
      activeCommand.body = false 
    } else if(newBody) {
      //if the new body is object (and not an array) 
      //we merge it into the original (if it was also an obj)  
      if(isObject(newBody) && isObject(activeCommand.body) 
      && !isArray(newBody) && !isArray(activeCommand.body)
      && newBody._stackfireMerge) {
        delete newBody._stackfireMerge 
        activeCommand.body = merge(activeCommand.body, newBody) 
      } else {
        activeCommand.body = newBody 
      }
    } 
    //(undefined newBody will not overwrite the command's
    // previous .body value) 
    matchingListener.running = false 
    matchingListener.runningStop = Date.now() 

    if(listener.onceOnly) {
      listeners = filter( listeners, listener => 
        listener.id !== matchingListener.id
      ) 
      //delete matchingListener
    }
    if(doBreak) {
      log('do break!') 
      break 
      return 
    }
  }

  //we have to remove the onceOnly's if a break happened: 
  if(doBreak) {
    listeners = filter( listeners, 
      listener => !listener.onceOnly) 
  }

  await stackUtil('fire_complete', activeCommand)     
  looping = false 
  r(activeCommand.body)
})              


stack.merge = newBody => {
  newBody._stackfireMerge = true 
  return newBody 
} 

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
    if (property === 'fireQ') {
      let theFireQ = () => fireQ
      return theFireQ()  
    }   
    if (property === 'listeners') {
      let theListeners = () => listeners  
      return theListeners()  
    }  
    if (property === 'command') {
      let theCommand = () => command 
      return theCommand()  
    }   
    if (property === 'body') {
      let body = () => command.body 
      return body()  
    }
    if (property === 'store' ) {
      let store = ()=> command.store 
      return store() 
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
