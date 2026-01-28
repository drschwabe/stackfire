const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

const delay = async seconds => 
  await new Promise(r => 
    setTimeout(r, seconds ? seconds * 1000 : 1000 ))

test('listeners do not run twice', async t => {

  t.plan(1) 

  stack.on('keydown/*key', () => 
    log('hello') 
  ) 

  stack.on('keydown/Delete', async () => {
    log('keydown/Delete') 
    await delay(1) 
  }) 

  stack.on('keydown/Enter', () => 
    log('Enter') 
  ) 

  stack.on('keydown/x', () => 
    t.ok('keydown/x') 
  ) 


  stack.on('keydown/v', async () => {
    log('keydown/v') 
    await delay(1) 
  }) 

  await stack.fire('keydown/x') 

  await delay(1) 

  t.end() 
})

