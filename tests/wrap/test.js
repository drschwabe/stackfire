
module.exports = (test, stack) => {

  test('Can wrap a normal function in a fire', t => {
    t.plan(4)

    let helloWorld = () => {
      console.log('hello world')
      t.pass('helloWorld original function ran')
    }

    helloWorld = stack.wrap(helloWorld)

    stack.on('helloWorld', () => {
      t.pass('helloWorld listener ran')
    })

    helloWorld()
    stack.fire('helloWorld')

  })

}