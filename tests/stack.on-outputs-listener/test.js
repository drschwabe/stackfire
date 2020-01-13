module.exports = (test, stack) => {
  const _ = require('underscore')

  test("stack.on outputs a listener", (t) => {
    t.plan(3)

    let listener = stack.on('do-something')

    t.ok(listener.path, 'listener has a path')
    t.ok(_.isString(listener.path), 'listener.path is a string')

    t.ok(listener.route && listener.route.reverse && listener.route.match, 'listener.route (listener data obj (via "route-parser" module) is as expected')
  })
}


