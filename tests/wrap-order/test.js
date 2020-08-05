
module.exports = (test, stack) => {

  test('Can wrap a function and it runs in order (with or without trailing callback)', t => {
    t.plan(2)

    let listenerCount = 0

    let helloWorld = () => {
      console.log('helloWorld original function ran')
      listenerCount++
      t.equals(listenerCount, 1)
    }

    stack.wrap(helloWorld)

    stack.on('helloWorld', () => {
      console.log('helloWorld listener ran')
      listenerCount++
      t.equals(listenerCount, 1)
    })

    helloWorld()

  })

}