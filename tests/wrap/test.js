
module.exports = (test, stack) => {

  test('Can wrap a normal function in a fire', t => {
    t.plan(4)

    let listenerCount = 0

    let helloWorld = () => {
      console.log('helloWorld original function ran')
      listenerCount++
    }

    helloWorld = stack.wrap(helloWorld)

    console.log('hello.world() ...')
    helloWorld()  //< invokes 1 listener
    t.equals(  listenerCount , 1, 'holloWorld() called after stack.wrap(helloWorld) invokes')

    listenerCount = 0
    console.log('stack.fire("hello-world") ...')
    stack.fire('hello-world')  //< invokes just the original function since above we are listening for the camel case one
    t.equals(  listenerCount , 1, 'stack.fire("hello-world")invokes the stack.wrap(helloWorld) original function')

    const hello = {}
    hello.world = () => {
      console.log('hello.world original function ran')
      listenerCount++
    }

    stack.on('hello/world', () => {
      console.log('hello/world listener ran')
      listenerCount++
    })

    //hello.world = stack.wrap(hello.world, 'hello/world')
    hello.world = stack.wrap(hello, 'hello.world')

    listenerCount = 0

    console.log('hello.world() ...')
    hello.world()

    t.equals(  listenerCount , 2, 'hello.world() called after stack.wrap(hello, "hello.world") invokes')
    //^ you must currently provide the stack path of manual

    listenerCount = 0

    console.log('stack.fire("hello/world") ...')
    stack.fire('hello/world')
    t.equals(  listenerCount , 2, 'stack.fire("hello/world") called after stack.wrap(hello, "hello.world") invokes')

  })

}