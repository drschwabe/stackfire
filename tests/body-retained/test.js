const _ = require('underscore')

module.exports = (test, stack) => {

  test("Body retained after mid fire", (t) => {
    t.plan(3)

    //async alt:
    stack.on('green', () => {
      t.equals(stack.body().hex, '#008000', 'body object has expected property')
      stack.fire('red', '#ff0000')
    })

    stack.on('green', () => {
      t.equals(stack.body().hex, '#008000', 'body object has expected property (after invoking a stack.fire on previous listener)')
    })

    //or with just a string:
    stack.on('red', () => {
      t.equals(stack.body(), '#ff0000', 'body object is expected value ')
    })

    stack.fire('green', { hex : '#008000' })

  })
}