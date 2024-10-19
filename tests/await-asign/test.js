const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('can await/assign a variable to a fire', 
  async t => {
  t.plan(1)

  stack.on('jump', () => {
    return 'a jump has occurred' 
  }) 

  log('fire complete') 
  const didJump = await stack.fire('jump')

  t.equals(didJump, 'a jump has occurred') 
})


test('can await/assign a variable to a branch', 
  async t => {
  t.plan(2)

  stack.on('jump', async () => {

    const { attacking } = await stack.branch('attack')
    t.equals(attacking, true, 'awaited the branch and got back expected value')

    return 'a jump has occurred' 
  }) 

  stack.on('attack', () => {
    return { attacking : true } 
  }) 

  log('fire complete') 

  const didJump = await stack.fire('jump')

  t.equals(didJump, 'a jump has occurred') 
})


