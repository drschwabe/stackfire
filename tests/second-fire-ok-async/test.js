module.exports = (test, stack) => {

  test("Second fire OK (async)", (t) => {
    t.plan(10)

    let listenerCount = 0;
    stack.on('apple', () => {
      listenerCount++
      t.equals(listenerCount, 1)
      console.log('first apple callback')
    })

    stack.on('apple', (next) => {
      listenerCount++
      t.equals(listenerCount, 2)
      console.log('2nd apple callback (async)')
      setTimeout(next, 500)
    })

    stack.on('apple', () => {
      listenerCount++
      t.equals(listenerCount, 3)
      console.log('third apple callback')
    })

    let fireCount = 0
    stack.fire('apple', () => {
      fireCount++
      t.equals(fireCount, 1, 'first apple command completed first')
      t.equals(listenerCount, 3, 'three listeners were invoked')
      listenerCount = 0
    })

    stack.fire('apple', () => {
      fireCount++
      t.equals(fireCount, 2, 'second apple command completed second')
      t.equals(listenerCount, 3, 'three listeners were invoked (again)')
    })

  })
}