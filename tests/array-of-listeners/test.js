const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('can supply an array of commands to listen for', t => {
  t.plan(2)
  stack.on(['jump-around', 'jumping'],
    () => t.pass('a jump has occurred'))
  stack.fire('jumping')
  stack.fire('jump-around')
})


test('can supply an array of commands to listen for (including wildcard)', t => {
  t.plan(3)
  stack.on(['jump/here', 'jump/*anywhere'],
    () => t.pass('a jump has occurred'))
  stack.fire('jump/here')
  stack.fire('jump/somewhere')
})  


