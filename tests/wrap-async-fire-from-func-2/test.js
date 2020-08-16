
module.exports = (test, stack) => {

  test('More wrap tests', t => {
    t.plan(2)

    let greetings = {
      goodbye : () => console.log('goodbye!')
    }

    stack.wrap(greetings, 'greetings.goodbye')

    // stack.on('say-stuff', () => {
    //   return 'stuff said'
    // })

    stack.on('say-stuff', () => {
      console.log('stuff said')
      return 'stuff said'
    })

    stack.on('say-stuff', next => {
      t.equals (   stack.body()  , 'stuff said', 'body is correct' )
      console.log('say stuff!')
      next.fire.greetings.goodbye()
      //next()
    })

    stack.on('greetings.goodbye', () => {
      t.pass('greetings.goodbye ran')
    })

    stack.fire('say-stuff')

  })
}