module.exports = (test, stack) => {

  test("Commands are agnostic to stating with a slash or not", (t) => {

    t.plan(5)

    stack.on('party', () => {
      t.pass("It's a party!")
    })

    stack.on('/party', () => {
      t.pass("it's the same party!")
    })

    stack.fire('party')

    stack.on('/earthquake', () => {
      t.pass('earthquake!')
    })

    stack.on('earthquake', () => {
      t.pass('earthquake!!!!')
    })

    stack.fire('/earthquake', () => {
      t.pass('finished earthquake')
    })

  })

}
