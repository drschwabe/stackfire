const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('can pause', async t => {
  t.plan(2)

  log('wait for pause...') 

  setTimeout( () => {
    t.ok(isPausing, 'pausing as intended') 
  }, 2000) 

  setTimeout( () => {
    stack.play() 
  }, 4000)  

  let isPausing = true 

  await stack.pause()

  isPausing = false 

  t.pass('unpaused ok') 
})

