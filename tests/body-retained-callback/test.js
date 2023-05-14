const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test("Body retained despite not returning anything", t => {
  t.plan(3)

  stack.on('launch', () => {
    t.equals(stack.body.status, 'liftoff', 
      'body object has expected property')
    return { status : 'airborne' }
  })

  stack.on('launch', () => {
    t.equals(stack.body.status, 'airborne', 
      `body object has expected property (after 
        previous listener modified it)`)
  })

  stack.on('launch', () => {
    return { status : 'hit the dome' } 
  })  

  stack.fire('launch', { status : 'liftoff' }, () => {
    t.equals( stack.body.status, 'hit the dome', 
    'final callback has the last modified value')
  })

})      
