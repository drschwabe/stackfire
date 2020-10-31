
module.exports = (test, stack) => {

  test('Can wrap a function and it runs in order (with or without trailing callback)', t => {
    t.plan(2)

    let listenerCount = 0

    let helloWorld = () => {
      console.log('helloWorld original function ran')
      listenerCount++
      t.equals(listenerCount, 0)
    }

    stack.wrap(helloWorld)

    stack.on('helloWorld', (next) => { //TODO: < add support for this style; just a string 'helloWorld'
      console.log('helloWorld listener ran')
      listenerCount++
      t.equals(listenerCount, 1)
      next()
    })
    //
    // stack.on.helloWorld(() => { //TODO: < add support for this style too
    //   console.log('helloWorld listener ran')
    //   listenerCount++
    //   t.equals(listenerCount, 1)
    // })

    helloWorld()

  })

}