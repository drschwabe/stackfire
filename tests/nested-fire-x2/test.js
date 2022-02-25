module.exports = (test, stack) => {
  test("stack.fire nested within stack.on, which was nested in another stack.on", (t) => {
    t.plan(3)
    stack.on('green', next => {
      t.pass("green listener's callback invoked")
      next.fire('blue')
    })

    stack.on('blue', next => {
      t.pass("blue listener's callback invoked")
      next.fire('red')
    })

    stack.on('red', () => {
      t.pass("red listener's callback invoked")
    })

    stack.fire('green')

  })
}