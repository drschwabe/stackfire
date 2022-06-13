const _ = require('underscore')

module.exports = (test, stack) => {

  test("fireSync executes within an async chain", t => {
    t.plan(3)

    stack.on('render/file', next => {
      log('render/object... ')
      const renderedObject = stack.fireSync('render/object', { color : 'blue' })
      log('fireSync complete')
      t.equals(renderedObject.color, 'purple', 
        'fireSync result was returned syncly and with modification from its matching listener')
      setTimeout(() => {
        next(null, { color : 'orange'})
      })
    })

    stack.on('render/object', () => {
      return { color : 'purple' }
    })

    stack.fire('render/file', { color : 'red' }, () => {
      t.pass('original async fire concluded')
      t.equals(stack.body().color, 'orange', 'original fire concluding body has been modified from an async listener')
    })

  })
}
