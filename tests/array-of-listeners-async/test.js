const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('can supply an array of commands to listen for (async)', 
  async t => {
  t.plan(2)
  stack.on(['jump-around', 'jumping'], async () => {
    t.pass('a jump has occurred')
  }) 
  await stack.fire('jumping')
  await stack.fire('jump-around')
})  
