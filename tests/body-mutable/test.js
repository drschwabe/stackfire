const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')


test("Body can be mutated and returned to ensure next listener has updated object", (t) => {
  t.plan(2)

  //async alt:
  stack.on('green', () => {
    t.equals(stack.body.shade, 'light', 'body object has expected property')
    return { shade : 'dark' }
  })

  stack.on('green', () => {
    t.equals(stack.body.shade, 
      'dark', 
      `body object has expected property 
      (after mutating/returning an updated value on previous listener)`)
  })

  stack.fire('green', { shade : 'light' })
}) 
