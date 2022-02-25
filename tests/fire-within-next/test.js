const _ = require('underscore')

module.exports = (test, stack) => {

  test("stack.fire within next context queues said fire'd command", (t) => {
    t.plan(1)

    let greenCount = 0

    stack.on('green', () => {
      console.log('green first (and firing red but it should run last)')
      greenCount++
      stack.fire('red')
    })

    stack.on('green', () => {
      console.log('green second')
      greenCount++
    })

    stack.on('red', () => {
      console.log('red last')
      t.equals(greenCount, 2)
    })

    stack.fire('green')

  })
}