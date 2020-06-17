module.exports = (test, stack) => {

  test("When a completed command is fired for the 2nd time, its callbacks all correctly re-enter the grid but in a new column", (t) => {
    t.plan(2)

    stack.on('apple', () => {
      console.log('first apple callback')
    })

    stack.on('apple', () => {
      console.log('2nd apple callback')
    })

    stack.on('apple', () => {
      console.log('third apple callback')
    })

    let count = 0
    stack.fire('apple', () => {
      count++
      t.equals(count, 1, 'first apple command completed first')
    })

    stack.fire('apple', () => {
      t.equals(count, 1, 'second apple command completed second')
    })

  })
}