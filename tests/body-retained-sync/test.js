const _ = require('underscore')

module.exports = (test, stack) => {

  test("Body retained mid fire and returns updated result - fireSync", t => {
    t.plan(4)

    stack.on('green', () => {
      t.equals(stack.body().hex, '#008000', 'body object has expected property')
      stack.fire('red', '#ff0000')
    })

    stack.on('green', () => 
      t.equals(stack.body().hex, '#008000', 'body object has expected property (after invoking a stack.fire on previous listener)')
    )

    //running out of the main sequence and was supplied a string: 
    stack.on('red', () => 
      t.equals(stack.body(), '#ff0000', 'body object is expected value ')
    )

    const result = stack.fireSync('green', { hex : '#008000' })

    t.equals(result, '#ff0000', 'updated result was returned')

  })
}
