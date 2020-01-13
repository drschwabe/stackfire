module.exports = (test, stack) => {
  test("stack.fire invokes stack.on", (t) => {
    t.plan(2)

    stack.on('/do-something', () => {
      t.ok('the listener function was called')
      t.equal(stack.path(), '/do-something', "stack.path equals '/do-something'")
    })

    stack.fire('/do-something')
  })
}


