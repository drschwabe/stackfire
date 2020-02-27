//feed a function and wrap it...
const _ = require('underscore')

module.exports = stack => {

  stack.wrap = functionToWrap => {

    stack.on(  functionToWrap.name , () => {
      if(functionToWrap.wrapping) return
      functionToWrap(stack.body()) //< we supply stack.body as param as way to transfer the params in this context
      //ie- stack.fire(functionToWrap.name, 'some extra param' ) //< stack.body() is 'some extra param'
    })

    return _.wrap( functionToWrap,  (func, ...params) => {

      let executeFunc = () => func(...params)
      //if we are already in a create-doc/save fire (ie- fired from another place in app) just run the func:
      if(stack.command && stack.command.path == functionToWrap.name) return executeFunc()
      //otherwise we invoke the fire on a one-time listener:
      func.wrapping = true
      stack.once(functionToWrap.name, executeFunc, 50)
      //if a command is in progress use next otherwise fire direct:
      if(stack.queue && stack.queue.length) {
        stack.next.fire(functionToWrap.name, () => {
          func.wrapping = false
        })
      } else {
        stack.fire(functionToWrap.name, () => {
          func.wrapping = false
        })
      }
    })
  }

}
