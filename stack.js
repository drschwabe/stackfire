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
  isObject, sortBy, indexOf, tail } = require('lodash')
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
const cache = new Map()

let command
let currentListenerParams = null

let frozen = false
let frozenExact = null
let frozenWild = null

stack.on = (...params) => {
  if(isArray(params[0])) {
    return params[0].forEach( path => 
      stack.on(path, ...tail( params ))
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


stack.fire = async (...params) => {
  if (frozen) return frozenFire(params)
  return await new Promise( async r => {
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

  const isCacheable = matchedListeners.some(l => l.cacheable)
  if (isCacheable && cache.has(path)) {
    return r(cache.get(path))
  }

  let result
  let parentCommand
  if(branch && loopDepth > 0) {
    //keep track of parent: 
    newCommand.branch = true 
    newCommand.parentPath = command.path  
    newCommand.parentCommandId = command.id 
    parentCommand = command
    const parentParams = currentListenerParams
    command = newCommand
    result = await loop(newCommand, matchedListeners)
    command = parentCommand
    currentListenerParams = parentParams
    newCommand.parentListener = parentListener
    if (isCacheable) cache.set(path, result)
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
    const queuedResult = await loop(nextCommandSet.command,
    nextCommandSet.matchedListeners) 
    nextCommandSet.promise(queuedResult)
  }

  if(!fireQed) {
    if (isCacheable) cache.set(path, result)
    r(result)
  }
})
}

stack.branch = async (...params) => {
  // The last command remains inspectable after dispatch; depth tracks active work.
  if (loopDepth === 0) return stack.fire(...params)
  if (frozen) return frozenBranch(params)
  return await new Promise( async r => {
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
}


const fireQ = [] 
let loopDepth = 0 
const loop = async (activeCommand, matchedListeners) => 
  await new Promise( async r => {
  // Mark dispatch active before hooks can enqueue or branch into more work.
  loopDepth++
  command = activeCommand
  await stackUtil('fire_started', activeCommand )
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

stack.auto = (...params) => stack.branch(...params)

stack.refresh = (...paths) => {
  for (let path of paths) {
    path = prefixPath(path)
    cache.delete(path)
  }
}

stack.refreshNow = async (...params) => {
  let path = find(params, param => isString(param))
  if (path) {
    path = prefixPath(path)
    cache.delete(path)
  }
  return await stack.auto(...params)
}

stack.flush = () => {
  listeners = []
  cache.clear()
}

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

// -- Frozen dispatch: pre-computed handler chains for static listener tables --

stack.freeze = () => {
  frozenExact = new Map()
  frozenWild = []

  const byPattern = new Map()
  for (let i = 0; i < listeners.length; i++) {
    const l = listeners[i]
    let group = byPattern.get(l.path)
    if (!group) { group = []; byPattern.set(l.path, group) }
    group.push({ func: l.func, priority: l.priority || (i + 10) })
  }

  for (const [pattern, entries] of byPattern) {
    entries.sort((a, b) => a.priority - b.priority)
    if (pattern.indexOf('*') !== -1 || pattern.indexOf(':') !== -1) {
      frozenWild.push({ route: new routeParser(pattern), entries: entries })
    } else {
      frozenExact.set(pattern, entries)
    }
  }

  frozen = true
  log('stackfire: frozen (' + frozenExact.size + ' exact, ' + frozenWild.length + ' wildcard)')
}

stack.unfreeze = () => {
  frozen = false
  frozenExact = null
  frozenWild = null
}

async function frozenDispatch(path, body) {
  path = prefixPath(path)

  const handlers = []
  let params = null

  const exactEntries = frozenExact.get(path)
  if (exactEntries) {
    for (let i = 0; i < exactEntries.length; i++)
      handlers.push({ func: exactEntries[i].func, priority: exactEntries[i].priority, params: null })
  }

  for (let i = 0; i < frozenWild.length; i++) {
    const match = frozenWild[i].route.match(path)
    if (match) {
      params = match
      const entries = frozenWild[i].entries
      for (let j = 0; j < entries.length; j++)
        handlers.push({ func: entries[j].func, priority: entries[j].priority, params: match })
    }
  }

  if (!handlers.length) return body

  handlers.sort((a, b) => a.priority - b.priority)

  const hasUtils = stack.utils.length > 0

  command = { path: path, body: body, params: params }
  if (hasUtils) {
    command.id = generateUUID()
    let fireFile, fireLine
    try {
      const e = new Error()
      const frame = e.stack.split('\n')[4]
      fireLine = frame.split(':').reverse()[1]
      fireFile = _s(frame).strRightBack('/')
        .strLeftBack(':').strLeftBack(':').value()
    } catch(err) {}
    command.fireLocation = { file: fireFile, line: fireLine }
  }
  currentListenerParams = params

  if (hasUtils) await stackUtil('fire_started', command)

  for (let i = 0; i < handlers.length; i++) {
    currentListenerParams = handlers[i].params
    if (hasUtils) {
      await stackUtil('listener_invoked', {
        command: command,
        listener: { func: handlers[i].func, path: path, priority: handlers[i].priority }
      })
    }
    const newBody = await handlers[i].func(body)

    if (newBody === null) {
      body = null
    } else if (newBody === false) {
      body = false
      break
    } else if (newBody !== undefined) {
      if (isObject(newBody) && newBody._stackfireCancel) {
        delete newBody._stackfireCancel
        body = newBody
        break
      } else if (isObject(newBody) && isObject(body)
        && !isArray(newBody) && !isArray(body)
        && newBody._stackfireMerge) {
        delete newBody._stackfireMerge
        body = merge(body, newBody)
      } else {
        body = newBody
      }
    }
    command.body = body
  }

  if (hasUtils) await stackUtil('fire_complete', command)

  currentListenerParams = null
  return body
}

async function frozenFire(params) {
  let path, body
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    if (typeof p === 'string' && !path) path = p
    else if (typeof p === 'object' && p !== null && !body) body = p
  }

  if (loopDepth > 0) {
    return new Promise(r => {
      fireQ.push({ frozenPath: path, frozenBody: body, promise: r })
    })
  }

  loopDepth++
  const result = await frozenDispatch(path || '', body)
  loopDepth--

  while (loopDepth === 0 && fireQ.length) {
    const next = fireQ.shift()
    loopDepth++
    const qResult = next.frozenPath !== undefined
      ? await frozenDispatch(next.frozenPath, next.frozenBody)
      : await loop(next.command, next.matchedListeners)
    loopDepth--
    next.promise(qResult)
  }

  return result
}

async function frozenBranch(params) {
  let path, body
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    if (typeof p === 'string' && !path) path = p
    else if (typeof p === 'object' && p !== null && !body) body = p
  }
  const parentCommand = command
  const parentParams = currentListenerParams
  try {
    return await frozenDispatch(path || '', body)
  } finally {
    command = parentCommand
    currentListenerParams = parentParams
  }
}

//Proxy to ensure we get the live command result for
//body, params, and path (when calling stack.body, etc)
const proxiedStack = new Proxy(stack, {
  get(target, property) {
    if (property === 'cache') {
      return cache
    }
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