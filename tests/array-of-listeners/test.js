const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')
const importFresh = require('import-fresh')

test('can supply an array of commands to listen for', t => {
  t.plan(2)
  stack.on(['jump-around', 'jumping'],
    () => t.pass('a jump has occurred'))
  stack.fire('jumping')
  stack.fire('jump-around')
})


test('can supply an array of commands to listen for (including wildcard)', t => {
  t.plan(3)
  stack.on(['jump/here', 'jump/*anywhere'],
    () => t.pass('a jump has occurred'))
  stack.fire('jump/here')
  stack.fire('jump/somewhere')
})  


test('array registration forwards handler, priority, once-only and options', async t => {
  const stack = importFresh('../../stack.js')
  const paths = ['alpha', 'beta']
  const options = { custom: { label: 'forwarded' } }
  const calls = []
  const handler = () => { calls.push(stack.path) }
  stack.on(paths, options, true, 2, handler)

  t.deepEqual(paths, ['alpha', 'beta'], 'input paths are unchanged')
  t.equal(stack.listeners.length, 2, 'one listener per path')
  for (const listener of stack.listeners) {
    t.equal(listener.func, handler, 'same handler forwarded')
    t.equal(listener.priority, 2, 'priority forwarded')
    t.equal(listener.onceOnly, true, 'once-only flag forwarded')
    t.deepEqual(listener.custom, options.custom, 'extra options forwarded')
  }
  for (const path of paths) {
    await stack.fire(path)
    await stack.fire(path)
  }
  t.deepEqual(calls, ['/alpha', '/beta'], 'each listener runs exactly once')
  stack.on([], handler)
  t.equal(stack.listeners.length, 0, 'empty path array adds nothing')
  t.end()
})
