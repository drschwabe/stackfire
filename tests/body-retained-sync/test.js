const _ = require('underscore')

module.exports = (test, stack) => {

  test("Body retained (simplified) - fireSync", t => {
    t.plan(3)

    stack.on('green', () => 
      t.equals(stack.body().hex, '#008000', 'body object has expected property')
    )

    stack.on('green', () => 
      t.equals(stack.body().hex, '#008000', 'body object has expected property (after invoking a stack.fire on previous listener)')
    )

    stack.fireSync('green', { hex : '#008000' })

    t.pass('test finshed')

  })
}
