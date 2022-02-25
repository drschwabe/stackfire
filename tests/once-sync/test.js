const _ = require('underscore')

module.exports = (test, stack) => {

  test("stack.once fires only once", (t) => {
    t.plan(1)

    let greenCount = 0

    stack.once('green', () => {
      console.log('green once')
      greenCount++
      //stack.fire('red')
    })

    stack.fire('green')
    stack.fire('green')
    t.equals(greenCount, 1)

  })
}