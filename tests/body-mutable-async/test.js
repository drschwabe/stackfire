const _ = require('underscore')

module.exports = (test, stack) => {

  test("Body can be mutated and returned to ensure next listener has updated object", (t) => {
    t.plan(2)

    //async alt:
    stack.on('green', next => {
      t.equals(stack.body().shade, 'light', 'body object has expected property')
      setTimeout( () => {
        next( null, { shade : 'dark' } )
      }, 500)
    })

    stack.on('green', () => {
      t.equals(stack.body().shade, 'dark', 'body object has expected property (after mutating/returning an updated value on previous listener)')
    })

    stack.fire('green', { shade : 'light' })

  })
}