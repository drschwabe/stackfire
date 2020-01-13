module.exports = (test, stack) => {
  test('buffer fires every listener invocation', (t) => {
    t.plan(8)

    stack.on('apples', () => {
      t.pass('apples on!')
    })
    stack.on('oranges', () => {
      t.pass('oranges on!')
    })

    stack.buffer(() => {
      t.pass('buffer!') //< Should run 4x; 2x per listener
    })

    stack.fire('apples', () => {
      t.pass('apples fire ran OK') //< buffers don't run on the trailing listener
    })
    stack.fire('oranges', () => {
      t.pass('oranges fire ran OK')
    })
  })
}