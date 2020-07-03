module.exports = (test, stack) => {
  test('next.end() ends the current command early', (t) => {
    t.plan(3)

    stack.on('green', () => {
      t.pass('listener 1')
    })
    stack.on('green', () => {
      t.pass('listener 2')
    })
    stack.on('green', (next) => {
      t.pass('listener 3')
      next.end()
    })
    stack.on('green', () => {
      t.fail('listener 4 (should not run!)')
    })
    stack.on('green', () => {
      t.fail('listener 5 (should not run!)')
    })

    stack.fire('green')

  })
}