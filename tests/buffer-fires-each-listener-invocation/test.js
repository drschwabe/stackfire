module.exports = (test, stack) => {
  test('buffer fires every listener invocation', (t) => {
    t.plan(6)

    stack.on('apples', () => {
      t.pass('apples on!')
    })
    stack.on('oranges', () => {
      t.pass('oranges on!')
    })

    stack.buffer(() => {
      t.pass('buffer!') //< Should run twice
    })

    stack.fire('apples', () => {
      t.pass('apples fire ran OK')
    })
    stack.fire('oranges', () => {
      t.pass('oranges fire ran OK')
    })
  })
}