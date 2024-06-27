const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('can await/assign a variable to a fire', 
  async t => {
  t.plan(1)
  const didJump = await stack.on('jump', () => {
    return 'a jump has occurred' 
  }) 
  log('fire complete') 
  await stack.fire('jump')
  t.equals(didJump, 'a jump occurred') 
})

