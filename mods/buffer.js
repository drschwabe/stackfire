const _ = require('underscore')

module.exports = (stack) => {
  stack.buffer = (...params) => {
    //TODO offer a 'path' param that would let you set the buffer to only execute on a given command string
    //for now stack only supports one buffer
    stack.buffer_func = _.find(params, (param) => _.isFunction(param))
  }
}