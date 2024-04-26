const { log, warn } = console
const importFresh = require('import-fresh') 
const stack = require('../../stack.js')
const test = require('tape')


test("stack.skip will skip the listener",  t => {
  t.plan(1)

  const stack = importFresh('../../stack.js')

  let count = 0 

  stack.on('work', () => {
    log('go to work!')
    count++
  }) 

  stack.skip('work', () => {
    log('keep working (this should not run)')
    count++ 
  })

  stack.on('work', () => {
    log('life is work') 
    count++ 
    t.equals(count, 2, 'only 2 of 3 listeners were invoked') 
  }) 

  stack.fire('work') 
})

test("stack.skip will skip the listener (retaining body)", t => {
  t.plan(4)

  const stack = importFresh('../../stack.js')

  let count = 0 

  stack.on('play', () => {
    count++
    return { fun :true }
  }) 

  stack.skip('play', () => {
    log('this should not run') 
    count++ 
  })

  stack.on('play', () => {
    t.ok(stack.body && stack.body.fun, 'original body exists after the skip') 
    if(!stack.body) return t.fail() 
    stack.body.awesome = true 
    return stack.body
  }) 

  stack.on('play', () => {
    count++ 
    t.equals(count, 2, 'only 2 of 3 listeners were invoked') 
    t.ok( stack.body.fun, 'original param still set') 
    t.ok( stack.body.awesome, 'new param added after the skip exists') 
    log('keep having fun')
  }) 

  stack.fire('play')  
}) 
 
