
module.exports = (test, stack) => {

  test('Can wrap a normal function in a fire', t => {
    t.plan(5)

    let helloWorld = () => {
      console.log('hello world')
      t.pass('helloWorld original function ran')
    }

    helloWorld = stack.wrap(helloWorld)

    stack.on('helloWorld', () => {
      t.pass('helloWorld listener ran')
    })

    helloWorld()  //< invokes 2 listeners
    stack.fire('helloWorld') //< invokes 2 listeners
    stack.fire('hello-world')  //< invokes just the original function since above we are listening for the camel case one

  })

}