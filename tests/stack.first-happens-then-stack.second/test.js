
module.exports = (test, stack) => {
  test('stack.first() happens, then stack.second() and so forth', (t) => {
    t.plan(3)

    let count = 0

    stack.second('park', () => {
      console.log('hit brake')
      count++
      t.equals(count, 2)
    })

    stack.first('park', () => {
      console.log('let off gas')
      count++
      t.equals(count, 1)
    })

    stack.third('park', () => {
      console.log('shift car into Park gear')
      count++
      t.equals(count, 3)
    })

    stack.fire('park')

  })
}
