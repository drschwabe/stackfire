const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('basic sync example #2 - only fired listener invoked', t => { 

  stack.on('/KEY_UP', () => {
    t.pass('correct listener invoked') 
  }) 

  stack.on('/KEY_DOWN', () => {
    t.fail('incorrect listener invoked!') 
  })  

  stack.fire('KEY_UP') 
  t.end()

}) 
