global.log = console.log
module.exports = (test, stack) => {
  const _ = require('underscore')

  test("Can catch wildcards (aka splats) with * character", t => {
    t.plan(2)

    stack.on('some/*path', () => {
      t.pass('some/*path invoked!')
    })

    stack.fire('some/path', () => {
      t.pass(`'some/path' fire complete`)
    })
  })  
}


