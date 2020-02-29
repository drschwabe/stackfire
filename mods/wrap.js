//feed a function and wrap it...
const _ = require('underscore')
const _s = require('underscore.string')

function camelCaseToDash (str) {
  return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase()
}

module.exports = stack => {

  stack.wrap = (...params) => {
    //parse params for the function and optionally, an object key value pair in the case of a lib function like myLib.myFunc()
    //also make a custom stack path to said function ie- helloWorld() becomes available as stack.fire('hello-world')
    //or in the case of a lib func like hello.world() it becomes avail as stack.fire('hello/world')
    let functionToWrap
    let stackPath
    if(_.isFunction(params[0])) {
      functionToWrap = params[0]
      stackPath = camelCaseToDash(functionToWrap.name).split('.').join('/')
    } else if(_.isObject(params[0]) && _.isString( params[1] ) ) {
      //user called:  stack.wrap( obj, 'obj.functionName')
      let objName = _s.strLeft( params[1], '.' )
      let funcName = _s.strRight(params[1], '.' )
      functionToWrap = params[0][funcName]
      stackPath = camelCaseToDash(params[1]).split('.').join('/')
    } else {
      return console.error('invalid params')
    }

    stack.on( stackPath , () => {
      if(functionToWrap.wrapping) return
      functionToWrap(stack.body()) //< we supply stack.body as param as way to transfer the params in this context
      //ie- stack.fire(functionToWrap.name, 'some extra param' ) //< stack.body() is 'some extra param'
    })

    return _.wrap( functionToWrap,  (func, ...params) => {

      let executeFunc = () => func(...params)
      //if we are already in a create-doc/save fire (ie- fired from another place in app) just run the func:
      if(stack.command && stack.command.path == stackPath) return executeFunc()
      //otherwise we invoke the fire on a one-time listener:
      func.wrapping = true
      stack.once(stackPath, executeFunc, 50)
      //if a command is in progress use next otherwise fire direct:
      if(stack.queue && stack.queue.length) {
        stack.next.fire(stackPath, () => {
          func.wrapping = false
        })
      } else {
        stack.fire(stackPath, () => {
          func.wrapping = false
        })
      }
    })
  }

}
