const delay = async (seconds) =>
  await new Promise((r) => setTimeout(r, seconds ? seconds * 1000 : 1000))

module.exports = (test, stack) => {
  test('stack.fire called without path works ok', t => {
    t.plan(1)

    let lightColor = 'green'

    stack.on('yellow', async next => {
      lightColor = 'yellow'
      log('light turned yellow') 
      await delay(2) 
      lightColor = 'red'
      next()
    })

    stack.fire('yellow')

    stack.fire(() => {
      t.equals(lightColor, 'red', 'light is red')
    })

  })
}
