
module.exports = (test, stack) => {

  test('More wrap tests', t => {
    t.plan(5)

    let helloWorld = () => console.log('helloWorld original function ran')
    let helloMoon = () => console.log('helloMooon original function ran')

    stack.wrap(helloWorld)
    stack.wrap(helloMoon)

    let greetings = {
      goodbye : () => console.log('goodbye!')
    }

    stack.wrap(greetings, 'greetings.goodbye')

    stack.on('helloWorld', next => {
      t.pass('helloWorld async listener ran')
      setTimeout(next, 100)
    })

    stack.last('helloWorld', () => {
      t.pass(`stack.last('helloWorld') listener ran`)
    })

    stack.last('helloWorld', next => {
      t.pass(`second stack.last('helloWorld') listener ran (async)`)
      next()
    })

    stack.last('helloWorld', next => {
      next.fire.helloMoon() 
    })


    stack.on('helloMoon', () => {
      t.pass('helloMoon ran')
    })

    stack.on('greetings.goodbye', () => {
      t.pass('greetings.goodbye ran')
    })

    stack.fire.helloWorld()
    //stack.fire.helloMoon() 
    stack.fire.greetings.goodbye() 

  })
}