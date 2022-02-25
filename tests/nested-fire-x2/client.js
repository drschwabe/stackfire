const Stack = require('../../stack.js')
const stack = new Stack()

const stackTools = require('stackfire-tools')
stackTools.inject(stack, { debug_on_select : true })

const test = require('tape-catch')
require('./test.js')(test, stack)