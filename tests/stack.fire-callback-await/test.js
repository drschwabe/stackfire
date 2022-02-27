module.exports = (test, stack) => {
  test('stack.fire can be supplied with a callback', async t => {
    //to execute after all other listener callbacks finish
    t.plan(3)

    stack.on('test', async next => {
      await new Promise(r => setTimeout(r, 100))
      console.log('async listener executed')
      next() 
    })

    stack.fire('test', () => {
      t.pass('callback is executed')
    })

    await new Promise(r => setTimeout(r, 200))
    //(runs after the fire is done) 

    t.notOk(stack.path(), 'there is no stack.path')
    t.notOk(stack.queue.length, 'stack.queue is clear')

  })
}

