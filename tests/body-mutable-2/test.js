const _ = require('underscore')

module.exports = (test, stack) => {

  test("Body can be mutated and returned to ensure next listener has updated object (using stack.last called before regular stack.on)", (t) => {
    t.plan(2)

    stack.last('green', () => {
      t.equals(stack.body().shade, 'dark', 'body object has expected property (after mutating/returning an updated value on previous listener)')
    })

    //async alt:
    stack.on('green', () => {
      t.equals(stack.body().shade, 'light', 'body object has expected property')
      return { shade : 'dark' }
    })


    stack.fire('green', { shade : 'light' })

  })
}