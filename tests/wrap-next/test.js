
module.exports = (test, stack) => {

  test('Can invoke a next.fire.wrappedFunction', t => {
    t.plan(7)

    //2 'warm up' tests...
    stack.on('ready', next => {
      t.pass('ready')
      next.fire('go')
    })

    stack.on('go', () => {
      t.pass('gone')
    })

    stack.fire('ready')

    const stop = () => {
      t.pass('stop (via function)')
    }

    stack.wrap( stop )

    stack.on('stop', () => {
      t.pass('stop (via listener)')
    })

    stack.fire.stop()


    //third test; here is where we are checking the specific matter:
    const autopilot = () => t.pass('autopilot (original function)')
    stack.wrap(autopilot)

    stack.on('takeoff', next => {
      next.fire.autopilot()
    })

    stack.on('autopilot', () => {
      t.pass('autopilot (invoked via listener)')
    })

    stack.fire('takeoff')

    //forth test:  using next.fire to access a wrapped 'lib.function' :
    const submarine = {
      submerge : () => t.pass('submarine (original function)')
    }
    stack.wrap(submarine, 'submarine.submerge')

    stack.on('deploy', next => {
      next.fire.submarine.submerge()
    })

    stack.fire('deploy')

  })

}