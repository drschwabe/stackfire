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
  isNull, filter, chain, 
  isBoolean, isArray, clone, isNumber, merge, 
  isObject, sortBy, indexOf } = require('lodash') 
const { rest } = require('underscore') 
const fnArgs = require('function-arguments')
const _s = require('underscore.string') 


function generateUUID() {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${randomPart}`
}

const prefixPath = path => 
  path.substr(0, 1) != '/' ? '/' + path : path 

const stack = {}
let listeners = []

let command
let currentListenerParams = null  

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
  const extraOptions = find(params, (param) => 
    isObject(param) && param !== func ) 

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

  listener.id = generateUUID() 

  if(extraOptions) listener = merge( listener, extraOptions ) 
  listeners.push(listener) 
}

stack.veryFirst = (...params) => stack.on(...params, -1)
stack.first = (...params) => stack.on(...params, 1)
stack.second = (...params) => stack.on(...params, 2)
stack.third = (...params) => stack.on(...params, 3)
stack.fourth = (...params) => stack.on(...params, 4)
stack.fifth = (...params) => stack.on(...params, 5)
stack.sixth = (...params) => stack.on(...params, 6)

stack.last = (...params) => stack.on(...params, 500)
stack.veryLast = (...params) => stack.on(...params, 9999)


stack.fire = async (...params) => 
  await new Promise( async r => {
  let path = find(params, param => isString(param))
  const callback = find( params, param => isFunction(param))

  let branch = find(params, param => isBoolean(param))
  //parent of the branch: 
  let parentListener = find(params, param=> isObject(param) &&
    param.func)    

  let body = find(params, param => isObject(param) && param !== parentListener)  
  if(!body) body = find(params, param => param !== path 
    && isString(param))  


  if(!path) path = Date.now().toString() //< create a one off
  path = prefixPath(path) 

  //create a command
  let newCommand = { 
    id : generateUUID(),   
    path : path, params : null, body }      

  if(body && body._stackfireStore) {
    delete body._stackfireStore
    newCommand.store = clone(body)  
  }

  if(parentListener) {
    newCommand.parentListenerId = parentListener.id 
    newCommand.parentListener = parentListener 
    //^ todo: only include the obj if debugging 
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
      //also store listener-specific params for use during execution
      listener.matchedParams = match
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
  if(branch && command) {
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
  } else {
    //get the original stack.fire function ... 
    //(so debugger can report location on fs) 
    let e = new Error()
    let line, file  
    try {
      let frame = e.stack.split("\n")[4] // change to 3 for grandparent func
      line = frame.split(":").reverse()[1]
      file = _s(frame).strRightBack('/')
      .strLeftBack(':').strLeftBack(':').value()  
    } catch(err) { warn(err) } 

    newCommand.fireLocation = { 
      file, line 
    }
  }

  //loop! 
  let fireQed 
  if(loopDepth > 0) {
    fireQ.push({ command: newCommand, matchedListeners, promise: r }) 
    await stackUtil('fireQ_appended', newCommand )    
    //log('## fireQ: ##') 
    //log(fireQ) 
    fireQed = true 
  } else {
    command = newCommand //< set the active command
    result = await loop(command, matchedListeners)                  
  }
 
  while(loopDepth === 0 && fireQ.length) {
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

  await stackUtil('fire_branch', { 
    path : params[0], 
    parentListener : runningListener
  }) 
  let result = await stack.fire(...params, true, runningListener) 
  r( result ) 
}) 


const fireQ = [] 
let loopDepth = 0 
const loop = async (activeCommand, matchedListeners) => 
  await new Promise( async r => {
  await stackUtil('fire_started', activeCommand )    
  loopDepth++ 
  command = activeCommand
  let doBreak 
  for await (const listener of matchedListeners) {
    let newBody  
    let matchingListener = find(listeners, thatListener => 
      thatListener.id === listener.id) 

    if(!matchingListener) {
      warn('could not find a matching listener (skipping)') 
      continue
    } 

    matchingListener.running = true 
    matchingListener.runningStart = Date.now() 
    matchingListener.parentCommandId = activeCommand.id 
    currentListenerParams = listener.matchedParams || null

    await stackUtil('listener_invoked',
      { command: activeCommand, listener : matchingListener })     
    //always await - handles async fns, transpiled async fns, and fns returning promises
    newBody = await listener.func(activeCommand.body)
    if(newBody === null ) {
      activeCommand.body = null 
    } else if(newBody === false) {
      //the listener has cancelled the command 
      doBreak = true
      activeCommand.body = false 
    } else if(newBody) {

      if(isObject(newBody) && newBody._stackfireCancel ) {    
        doBreak = true 
        delete newBody._stackfireCancel 
        activeCommand.body = newBody

      //if the new body is object (and not an array) 
      //we merge it into the original (if it was also an obj)   
      } else if(isObject(newBody) && isObject(activeCommand.body) 
        && !isArray(newBody) && !isArray(activeCommand.body)
        && newBody._stackfireMerge) {
        delete newBody._stackfireMerge 
        activeCommand.body = merge(activeCommand.body, newBody) 
      } else {
        activeCommand.body = newBody 
        command.body = newBody 
        //^ seems these objects can diverge hence needing to apply newBody twice
      }
    } 
    //(undefined newBody will not overwrite the command's
    // previous .body value) 
    matchingListener.running = false 
    matchingListener.runningStop = Date.now() 
    currentListenerParams = null 

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
  loopDepth-- 
  r(activeCommand.body)
})              


stack.merge = newBody => {
  newBody._stackfireMerge = true 
  return newBody 
} 

stack.auto = async (...params) => {
  const branchOrFire = command ? 'branch' : 'fire'
  const result = await stack[branchOrFire](...params)
  return result 
}

stack.flush = () => 
  listeners = [] //< empty listener array 

stack.skip = (...params) => {
  const path = prefixPath(params[0]) //< ensure prefixed with '/'
  //just create a new .on call which will be a simple pass thru 
  stack.on(path, () => { warn('skipping this listener') }, { skip : true })  
}

stack.pausing = false 

stack.pause = async () => {
  log('--- stack.pause invoked (pausing stack) ---') 
  stack.pausing = true  
  while (stack.pausing) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
} 
stack.play = () => {
  log('--- stack.play (stack resumed) ---') 
  stack.pausing = false
}
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
      let params = () => currentListenerParams || command.params 
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