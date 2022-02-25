module.exports = (test, stack) => {

  test('stack.once works as expected', (t) => {
    t.plan(1)
    let goCount = 0
    stack.once('go', () => {
      console.log('go!')
      goCount++
    })

    stack.fire('go')
    stack.fire('go')
    stack.fire('go')
    t.equals(goCount, 1, '"go" only invoked once')
  })

}