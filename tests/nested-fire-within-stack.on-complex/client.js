const Stack = require('../../stack.js')
const stack = new Stack()

const sGrid = require('stackfire4-tools')
sGrid.listen(stack)

const test = require('tape-catch')
require('./test.js')(test, stack)