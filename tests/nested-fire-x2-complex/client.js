const Stack = require('../../stack.js')
const stack = new Stack()

const stackTools = require('stackfire-tools')
stackTools.inject(stack)

const test = require('tape-catch')
require('./test.js')(test, stack)