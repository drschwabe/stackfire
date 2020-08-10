
module.exports = (test, stack) => {

  test('Can call multiple async wrapped fires in sequence (using function to fire) ', t => {
    t.plan(1)

    let listenerCount = 0

    let helloWorld = () => {
      console.log('helloWorld original function ran')
      listenerCount++
    }

    stack.wrap(helloWorld)

    stack.on('helloWorld', next => {
      console.log('helloWorld async listener ran')
      listenerCount++
      setTimeout(next, 100)
    })

    stack.fire.helloWorld()
    stack.fire.helloWorld()

    setTimeout(() => {
      t.equals(listenerCount, 4)
    }, 250)

  })
}