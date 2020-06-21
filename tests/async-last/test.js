
module.exports = (test, stack) => {
  test('stack.first() happens, then stack.second() and so forth', (t) => {
    t.plan(3)

    let count = 0

    stack.last('make-coffee', next => {
      console.log('drink!')
      setTimeout( () => {
        console.log('drink more')
        count++
        t.equals(count, 3)
      }, 1000)
    })

    stack.on('make-coffee', () => {
      console.log('grind beans!')
      count++
      t.equals(count, 1)
    })

    stack.on('make-coffee', () => {
      console.log('brew')
      count++
      t.equals(count, 2)
    })

    stack.fire('make-coffee')

  })
}
