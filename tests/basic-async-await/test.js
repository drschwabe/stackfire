module.exports = (test, stack) => {

  test('basic async/await example', async (t) => {
    t.plan(3)

    let state = {}

    let firstSip = async next => {
      state.listener = 'first'
      await new Promise(r => setTimeout(r, 100))
      console.log('first sip (takes 100 ms)')
      t.equals(state.listener, 'first')
      next()
    }

    let secondSip = async next => {
      state.listener = 'second'
      await new Promise(r => setTimeout(r, 200))
      console.log('third sip (takes 200 ms)')
      t.equals(state.listener, 'second')
      next()
    }

    let thirdSip = async next => {
      state.listener = 'third'
      await new Promise(r => setTimeout(r, 300))
      console.log('third sip (takes 300 ms)')
      t.equals(state.listener, 'third')
      next()
    }

    stack.on('sip latte', firstSip)

    stack.on('sip latte', secondSip)

    stack.on('sip latte', thirdSip)

    stack.fire('sip latte')

    await new Promise(r => setTimeout(r, 700))
    console.log('all good?')

  })
}