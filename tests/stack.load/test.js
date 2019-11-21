module.exports = (test, stack) => {
  test("stack.load", (t) => {
    t.plan(3)

    stack.on('/do-something', () => {
      t.fail('should not run')
    })

    let loadedCommand = stack.load('/do-something')

    t.ok(stack.queue.length, 'stack.queue is populated')

    t.ok(stack.queue[0] && stack.queue[0].path === '/do-something', 'stack.queue is populated with the command supplied to stack.load')

    t.equals(loadedCommand, stack.queue[0], 'stack.load returns the command')

  })
}


