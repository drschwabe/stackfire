module.exports = (test, stack) => {
  test('can supply an array of commands', t => {
    t.plan(1)
    stack.on(['jump-around', 'jumping'], () => t.pass('a jump has occurred'))
    stack.fire('jumping')
  })
}