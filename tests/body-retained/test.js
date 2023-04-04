const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test("Body retained despite not returning anything", t => {
  t.plan(3)

  stack.on('green', () => {
    t.equals(stack.body.hex, '#008000', 
      'body object has expected property')
  })

  stack.on('green', () => {
    t.equals(stack.body.hex, '#008000', 
      `body object has expected property (after 
        previous listener invoked nothing)`)
  })

  stack.on('green', () => {
    t.equals(stack.body.hex, '#008000', 
      `body object still has expected property`)
  })  

  stack.fire('green', { hex : '#008000' })
})      
