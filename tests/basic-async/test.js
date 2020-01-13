module.exports = (test, stack) => {
  test('basic async example', (t) => {
    t.plan(3)

    let state = {}

    let firstSip = (next) => {
      state.listener = 'first'
      setTimeout(() => {
        console.log('first sip (takes 100 ms)')
        t.equals(state.listener, 'first')
        next()
      }, 100)
    }

    let secondSip = (next) => {
      state.listener = 'second'
      setTimeout(() => {
        console.log('second sip (takes 200 ms)')
        t.equals(state.listener, 'second')
        next()
      }, 200)
    }

    let thirdSip = (next) => {
      state.listener = 'third'
      setTimeout(() => {
        console.log('third sip (takes 300 ms)')
        t.equals(state.listener, 'third')
        next()
      }, 300)
    }

    stack.on('sip latte', firstSip)

    stack.on('sip latte', secondSip)

    stack.on('sip latte', thirdSip)

    stack.fire('sip latte')

    setTimeout(() => {
      //check that the functions are placed in the same order:
      // t.equals( stack.grid.enties[0].func.toString(), firstSip.toString() )
      // t.equals( stack.grid.enties[1].func.toString(), secondSip.toString() )
      // t.equals( stack.grid.enties[2].func.toString(), thirdSip.toString() )
      console.log('all good?')
    }, 700)

  })
}