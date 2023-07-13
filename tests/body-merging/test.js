const { log, warn } = console
const test = require('tape')
const requireUncached = require('require-uncached') 

test("Previous properties on stack.body are lost if new object is supplied", t => {
  t.plan(3)

  const stack = requireUncached('../../stack.js')

  stack.on('green', () => {
    t.equals(stack.body.hex, '#008000', 
      `body object has expected property (after 
        previous listener invoked nothing)`)
    return { name : 'green' } 
  })

  stack.on('green', () => {
    log(stack.body) 
    t.equals(stack.body.name, 'green', 
      'New property is present on stack body') 
    t.notOk(stack.body.hex, 
      "previous property is omitted because it wasn't included on the last listener's return object") 
  })  

  stack.fire('green', { hex : '#008000' })
})      


test("Properties on stack.body are retained if stack.merge is used", t => {
  t.plan(4)

  const stack = requireUncached('../../stack.js')

  stack.on('green', () => {
    t.equals(stack.body.hex, '#008000', 
      `body object has expected property (after 
        previous listener invoked nothing)`)
    return stack.merge({ name : 'green' })  
  })

  stack.on('green', () => {
    log(stack.body) 
    t.equals(stack.body.name, 'green', 'New property is present on stack body') 
    t.ok(stack.body.hex, 'Previous property is included') 
    t.equals(stack.body.hex, '#008000' , 'Previous property value is correct') 
  })  

  stack.fire('green', { hex : '#008000' })
}) 
