const _ = require('underscore')

module.exports = (test, stack) => {

  test("Parameter test", (t) => {
    t.plan(4)

    //async alt:
    stack.on('green', () => {
      t.ok( _.isObject( stack.body() ))
      t.equals(stack.body().hex, '#008000', 'object has expected property')
    })

    stack.fire('green', { hex : '#008000' })

    //or with just a string:
    stack.on('red', () => {
      t.ok( _.isString( stack.body() ))
      t.equals(stack.body(), '#ff0000', 'body has expected value ')
    })

    stack.fire('red', '#ff0000')

  })
}