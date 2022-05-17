global.log = console.log
module.exports = (test, stack) => {
  const _ = require('underscore')

  test("Can catch wildcards (aka splats) with * character (test 2)", t => {
    t.plan(3)

    stack.on('some/*path', () => {
      t.pass(`some/*path ran`)
    })

    stack.on('some/specific/path', () => {
      t.pass(`some/specific/path ran`)
    })
    
    stack.fire('some/specific/path', () => {
      t.pass(`some/specific/path fire complete`) 
    })

  })
  

}


