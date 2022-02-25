  module.exports = (test, stack) => {
    test("stack.fire nested within stack.on, which was nested in another stack.on (complex)", (t) => {
      t.plan(9)

      stack.on('green', () => {
        t.pass("green listener's first callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's second callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's third callback invoked")
      })

      stack.on('green', (next) => {
        t.pass("green listener's fourth callback invoked")
        next.fire('blue')
      })

      stack.on('green', () => {
        t.pass("green listener's last callback invoked")
        //TODO:  another check to ensure blue and red commands finished
      })

      stack.on('blue', () => {
        t.pass("blue listener's first callback invoked")
      })

      stack.on('blue', () => {
        t.pass("blue listener's second callback invoked")
      })

      stack.on('blue', (next) => {
        t.pass("blue listener's third callback invoked")
        next.fire('red')
      })

      stack.on('red', () => {
        t.pass("red listener's callback invoked")
      })

      stack.fire('green')

    })
  }