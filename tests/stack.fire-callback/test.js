module.exports = (test, stack) => {
  test('stack.fire can be supplied with a callback', (t) => {
    //to execute after all other listener callbacks finish
    t.plan(3)

    stack.fire('test', () => {
      t.pass('callback is executed')
    })

    t.notOk(stack.path(), 'there is no stack.path')
    t.notOk(stack.queue.length, 'stack.queue is clear')

  })
}

