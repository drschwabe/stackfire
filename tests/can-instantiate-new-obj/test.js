
module.exports = (test) => {

  const Stack = require('../../stack.js')

  test('Can instantiate a new object', (t) => {
    t.plan(2)

    const stackA = new Stack()

    stackA.on('something')

    t.equals( stackA.listeners.length, 1)

    const stackB = new Stack()
    //Check that the object is not cached or shared:
    t.equals(stackB.listeners.length, 0)
  })
}