module.exports = (stack) => {
//Listener creation function:
  stack.on = (...params) => {

    let pathOrPathsOrCommandOrFunction = params[0],
      priority = _.find(params, (param) => _.isNumber(param) ),
      callback = _.find(params, (param) => _.isFunction(param) && _.indexOf(params, param) != 0),
      path,
      existingCommand,
      func

    if(_.isFunction( pathOrPathsOrCommandOrFunction)) {
      console.log('we got a function')
      //find the corresponding function in stack.libraries...
      func = pathOrPathsOrCommandOrFunction
      let matchingFunc = false
      stack.libraries.forEach((lib) => {
        let match = _.find(lib, (libProperty) => libProperty == func)
        if(match) {
          matchingFunc = match
          path = 'function/' + _.findKey(lib, (libProperty) => libProperty == func)
          console.log(path)
        } else {
          console.warn('there was no matching function found')
        }
      })
      //if we provide a command we can skip the path stuff...
    } else if(_.isObject(pathOrPathsOrCommandOrFunction) && !_.isArray(pathOrPathsOrCommandOrFunction)) {
      path = pathOrPathsOrCommandOrFunction.route.spec
      existingCommand = pathOrPathsOrCommandOrFunction
      //If an array...
    } else if(_.isArray(pathOrPathsOrCommandOrFunction)) { //just re-call this function with each path:
      pathOrPathsOrCommandOrFunction.forEach( (path) => {
        if(priority) return stack.on(path, priority, callback)
        stack.on(path, callback)
      })
      return
    } else { //otherwise continue with the single path:
      path = pathOrPathsOrCommandOrFunction
    }

    //Ensure path always is prefixed with a slash:
    path = prefixPath(path)

    //Create a route from the path:
    let route = new routeParser(path)

    let pathIsWild = _s.include(path, "*"),
      pathHasParams = _s.include(path, ":"),
      matchedFromPath,
      reversedRoute = route.reverse(path)

    //Determine if this path corresponds to a command
    //already defined (via a previous stack.on call) in our stack:
    if(!existingCommand) existingCommand = _.find(stack.commands, (establishedCommand) => {
      let commandIsWild = _s.include(establishedCommand.route.spec, "*")
      let commandHasParams = _s.include(establishedCommand.route.spec, ":")
      matchedFromPath = route.match(establishedCommand.route.spec)
      let matchedFromCommandPath = establishedCommand.route.match(path) //< could be param!
      if(matchedFromPath ||  matchedFromCommandPath && !pathHasParams) return true
      if(matchedFromPath && reversedRoute && commandIsWild) return true
      //if(reversedRoute && pathIsWild) return true
      return false
    })

    //if the path is wild, there may be multiple existing commands, so let's run it again:
    var existingCommands
    if(pathIsWild) {
      existingCommands = _.filter(stack.commands, (establishedCommand) => {
        if( establishedCommand.route.spec != route.spec && route.match(establishedCommand.route.spec) ) return true
      })
    }

    //Either way, we will create a listener entry;
    //with two properties: an async handler function
    //(which calls a callback) and the raw path...
    const newListener = { func : callback, path: path, _id : uuid.v4()  }

    let newCommand

    if(!existingCommand && !pathHasParams) {
      //No existing command, so let's define one now,
      //with two properties: the route and an array to store listeners...
      newCommand = { route: route, listeners: [newListener] }
      stack.commands.push(newCommand)
      //make an alias :
      if(stack.aliaser) {
        stack.aliaser[  _s(path).substr(1).replaceAll('/', '-').camelize().value()   ] = (...args) => stack.fire(path, ...args)
      }
    } else if(pathIsWild && existingCommands.length) {
      //if the path is wild and there are existing commands matched...
      existingCommands.forEach((theCommand) => {
        theCommand.listeners.push(newListener)
      })
    } else if(!pathHasParams || pathHasParams && _.isObject(pathOrPathsOrCommandOrFunction)){
      //If the command already exists, just push this new
      //listener into the command's existing stack...
      existingCommand.listeners.push(newListener)
    } else {
      //path has params
      newListener.route = route
      newListener.params = matchedFromPath
      stack.parameter_listeners.push(newListener)
      //may also need to create a new command here...

      if(stack.aliaser) {

        //let params = _.rest(words, 1)
        let words = _s(path).substr(1).replaceAll('/', '-').camelize().words(':')

        stack.aliaser[words[0]] = (...params) => {
          //Save the structure of the pathname and its chunks/params:

          let specChunks = _s.words(path, '/')

          //... and use it to reconstruct the original path,
          //putting the params where they need to go:
          let mirrorParamIndex = -1
          specChunks = _.map(specChunks, (chunk, index) => {
            if( chunk.search(':') < 0 ) return chunk
            mirrorParamIndex++
            return params[mirrorParamIndex]
          })
          //also include a body if one was provided ie- stack.fire('path', { body })
          let body = _.find(params, (param) => _.isObject(param) )
          if(body) return stack.fire( specChunks.join('/'), body)
          let firePath =  specChunks.join('/') //For some reason an extra slash may be appended; if so, remove it:
          if(_s.include(firePath, '//')) firePath = firePath.substr(0, firePath.length - 2)
          return stack.fire( firePath )
        }
      }
    }

    //Do a check to see if the existingCommand needs to add a matching parameter route
    if(!pathHasParams) {
      stack.parameter_listeners.forEach((parameterListener) => {
        //determine if the parameterListener should be attached to this command...
        var matchedFromParameterListener = parameterListener.route.match(path)
        if(matchedFromParameterListener) {
          //add to the front of this new command
          if(!existingCommand) {
            var parameterListenerClone = _.clone(parameterListener)
            parameterListenerClone.path = path
            newCommand.listeners.unshift(parameterListenerClone)
          }
        }
      })
    } else {
      //find existing listeners it may match...
      let existingCommandNonParam = _.find(stack.commands, (existingCommand) => {
        let matchedFromPath = route.match(existingCommand.route.spec)
        return matchedFromPath
      })
      //an existing (non param) command has been established
      //which has a matching pattern, so we now
      //add this listener's callback (which was defined with a matching stack.on call but using a param; hence same pattern) to said existing command's listeners:
      if(existingCommandNonParam) {
        newListener.path = existingCommandNonParam.route.spec
        existingCommandNonParam.listeners.push(newListener )
      }
    }
    if(pathIsWild) {
      route.isWild = true
    }

    const _l = require('lodash')

    if(priority && existingCommand) {
      newListener.priority = priority
      newListener.nth = true
      existingCommand.listeners = _l.sortBy(existingCommand.listeners, ['priority', 'nth'])
      stack.commands.push(existingCommand)
    } else if(!priority && existingCommand) {
      existingCommand.listeners = _.without(existingCommand.listeners, newListener)
      let defaultPriority = existingCommand.listeners.length + 1
      let minPriority = _.min(existingCommand.listeners, (listener) => listener.priority).priority
      let maxPriority = _.max(existingCommand.listeners, (listener) => listener.priority).priority
      //need to factor in some listeners are not explicity priority; so they can be bumped around ..
      if(minPriority + 1 < maxPriority) newListener.priority = minPriority + 1
      existingCommand.listeners.push(newListener)
      existingCommand.listeners = _.sortBy(existingCommand.listeners, (listener) => listener.priority)
      stack.commands.push(existingCommand)
    } else if(!existingCommand) {
      if(func) {
        //in this case the listener we created above is the callback so we want it to run after the
        //listener we create below:
        newListener.priority = 999
      } else {
        newListener.priority = 1
      }
    }

    //create another on listener which includes the function itself if the function listener has not yet already been added...
    if(func) {


      //Check to see if this is added yet..
      if(existingCommand) return

      stack.on(path, 1, (next) => {
        let preNextCallback = (err, res) => {
          if(err) stack.err = err
          if(res) stack.res = res
          //at this point the res has been set
          next()
        }
        let partialFunc = _.partial(func, _, preNextCallback)
        partialFunc(stack.params.body)
      })
    }
  }
}

