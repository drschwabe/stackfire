const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test("Body retained after mid fire", t => {
  t.plan(3)

  let greenIsDone = false 

  stack.on('green', () => {
    log('green on 1') 
    t.equals(stack.body.hex, '#008000', 
      'body object has expected property')
    stack.fire('red', '#ff0000')
  })

  stack.on('green', () => {
    log('green on 2') 
    t.equals(stack.body.hex, '#008000', 
      `body object has expected property 
      (after a nested stack.fire on previous listener)`)
    greenIsDone = true 
  })


  //or with just a string:
  stack.on('red', () => {
    log('red on 1 (should execute after green 1 and 2)') 
    if(greenIsDone === false) {
      t.fail('original command did not complete') 
      //throw 'original command did not complete'
    }
    t.equals(stack.body, '#ff0000', 
      'body object is expected value ')
  })

  stack.fire('green', { hex : '#008000' })

}) 
