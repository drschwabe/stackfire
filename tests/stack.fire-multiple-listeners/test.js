module.exports = (test, stack) => {
  test('stack.fire can be supplied with a callback (plus multiple listeners)', (t) => {
    t.plan(3)

    stack.on('test', () => {
      t.pass('listener invoked')
    })

    stack.on('test', () => {
      t.pass('second listener invoked')
    })

    stack.fire('test', () => {
      t.pass('callback is executed')
    })
  })
}
