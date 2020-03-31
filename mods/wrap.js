//feed a function and wrap it...
const _ = require('underscore')
const _s = require('underscore.string')

function camelCaseToDash (str) {
  return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase()
}

module.exports = stack => {

  stack.wrapped = []
  stack.wrap = (...params) => {
    //parse params for the function and optionally, an object key value pair in the case of a lib function like myLib.myFunc()
    //also make a custom stack path to said function ie- helloWorld() becomes available as stack.fire('hello-world')
    //or in the case of a lib func like hello.world() it becomes avail as stack.fire('hello/world')
    let functionToWrap
    let stackPath
    let objName
    let funcName
    if(_.isFunction(params[0])) {
      functionToWrap = params[0]
      stackPath = functionToWrap.name
    } else if(_.isObject(params[0]) && _.isString( params[1] ) ) {
      //user called:  stack.wrap( obj, 'obj.functionName')
      objName = _s.strLeft( params[1], '.' )
      funcName = _s.strRight(params[1], '.' )
      functionToWrap = params[0][funcName]
      stackPath =  params[1]
      stack.fire[objName] = params[0]
    } else {
      return console.error('invalid params')
    }

    //existing wrapped listener?  there can only be one:
    let existingWrapListener = _.find( stack.listeners, listener => listener.path === stackPath && listener.wrapped )

    if(!existingWrapListener) {
      stack.on( stackPath , () => {
        //we supply stack.body as param as way to transfer the params in this context:
        let body = stack.body() //determine if its a 'packed' array (function supplied with multiple params)...
        if(!body) return functionToWrap()
        if(body.packed) return functionToWrap(...body)
        //or if body is single param
        return functionToWrap(body)
        //ie- stack.fire(functionToWrap.name, 'some extra param' ) //< stack.body() is 'some extra param'
      }, { wrapped : true})
    }

    let wrappedFunc = _.wrap( functionToWrap,  (func, ...params) => {
      let executeFunc = () => func(...params)
      executeFunc.wrapped = true
      stack.fire(stackPath, ...params, () => {
        //next()
        console.log('fired wrapped function')
      })
    })

    if(objName) {
      stack.fire[objName][funcName] = wrappedFunc
      //add also to .wrapped object this will become merged with the 'next' obj each fire
      //so that they are available to said next obj
      stack.wrapped.push( {
        [objName] : {
          [funcName] : functionToWrap, //< we dont wrap it yet
          stackPath : stackPath,
          objName : objName,
          funcName : funcName
        }
      })
      return
    }
    stack.fire[stackPath] = wrappedFunc
    stack.wrapped.push({ [stackPath] : functionToWrap })
  }
}
