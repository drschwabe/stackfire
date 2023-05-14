const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test("Can catch wildcards (aka splats) with * character", t => {
  t.plan(3)

  stack.on('some/*path', () => {
    t.pass('some/*path invoked!')
  })

  stack.fire('some/thing', () => {
    t.pass(`'some/*path' fire complete`)
  })

  stack.fire('some/other-thing') 
})   


test(`Can catch wildcards (aka splats) 
  with * character (using array of paths)`, t => {
  t.plan(4)

  stack.on(['some', 'some/*path'], () => 
    //this runs three times: 
    t.pass('some/*path invoked!')
  )

  stack.fire('some/thing', () => {
    //passes once: 
    t.pass(`'some/*path' fire complete`)
  })
  stack.fire('some/other-thing') 
  stack.fire('some') 
})   


test.only(`Can catch wildcards (aka splats) 
  with * character (using array of paths)`, t => {
  t.plan(3)

  stack.on(['some', 'some/*path'], () => 
    //this runs three times: 
    t.pass('some/*path invoked!')
  )

  stack.fire('some/thing')
  stack.fire('some/other-thing') 
  stack.fire('some') 
})     
