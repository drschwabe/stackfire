const { log, warn } = console
const stack = require('../../stack.js')
stack.logUtil() 
const test = require('tape')

test("Final callback is only executed once", 
  async t => {
  t.plan(2)

  stack.on('launch', () => {
    log('hit the dome!') 
    return { status : 'hit the dome' } 
  })  

  await stack.fire('launch',
    { status : 'liftoff' }, () => {
    log('trailing callback 1 complete') 
    t.equals( stack.body.status, 'hit the dome', 
    'final callback has the last modified value')
  })

  //run it twice: 
  await stack.fire('launch', 
    { status : 'liftoff' }, () => {
    log('trailing callback 2 complete') 
    t.equals( stack.body.status, 'hit the dome', 
    'final callback has the last modified value')
  }) 
})      
