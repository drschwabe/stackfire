var test = require('tape'), 
    stack = require('./stack.js')

test("stack.fire('/do-something') to invoke stack.on('/do-something')", (t) => {
  t.plan(2)

  stack.on('/do-something', (state, next) => {
    t.ok(state, 'listener invoked')    
    t.equal(state._command.path, '/do-something', "state._command.path equals '/do-something'")
  })

  stack.fire('/do-something') 

})

test("stack.fire from within a stack.on listener", (t) => {
  t.plan(2)

  stack.on('/do-something-else', (state, next) => {
    //Nested fire: 
    stack.fire('/do-another-thing', (err, newState) => {
      next(null, newState)
    })
  })

  stack.on('/do-another-thing', (state, next) => {
    t.ok(state, 'root level listener invoked from a nested fire')
    t.equal(state._command.path, '/do-another-thing', "state._command.path equals the command from the nested fire (not the original command).")    
  })
  
  //Original command: 
  stack.fire('/do-something-else')

})


test("fire 3 commands and verify state consistency along the way", (t) => {
  t.plan(6)

  stack.on('/land-on-moon', (state, next) => {
    state.landed = true
    t.ok(state.landed, 'landed on moon') 
    //Second command fired: 
    stack.fire('/plant-flag', state, (err, newState) => {
      t.ok(newState.landed, 'still landed')
      state.flagPlanted = true
      t.ok(state.flagPlanted, 'planted flag')      
      //Third command fired: 
      stack.fire('/take-picture', (err, newState) => {
        t.ok(newState.landed && newState.flagPlanted, 'still landed and flag remains planted')
        state.tookPicture = true 
        t.ok(state.tookPicture, 'took picture')
        next(null, state)
      })
    })
  })

  //First command fired: 
  stack.fire('/land-on-moon', (err, finalState) => 
    t.ok(finalState.landed && finalState.flagPlanted && finalState.tookPicture, 'mission complete'))

})


test("Different command listeners should not fire from a single command", (t) => {

  stack.on('/go', (state, next) => {
    t.ok(state, 'expected listener invoked')
    next(null, state)
  })

  //This should not run: 
  stack.on('/stop', (state, next) => {
    t.fail('listener invoked when it should not have')
    next(null, state)
  }) 

  stack.fire('/go', (err, state) => {
    t.ok(state, 'end of stack reached')
    t.end()
  })

})

test("(same as above, but more complex route)", (t) => {

  stack.on('/go/somewhere', (state, next) => {
    t.ok(state, 'expected listener invoked')
    next(null, state)
  })

  //This should not run: 
  stack.on('/stop/something', (state, next) => {
    t.fail('listener invoked when it should not have')
    next(null, state)
  }) 

  stack.fire('/go/somewhere', (err, state) => {
    t.ok(state, 'end of stack reached')
    t.end()
  })

})

//Test to ensure stack.state is updated as expected. 
test("stack.state", (t) => {
  t.plan(2)
  stack.fire('/take-off', (err, state) => {
    t.equals(stack.state, state, 'stack.state equals the newly returned state')
    state.flying = true 
    stack.fire('/autopilot', (err, stateB) => {
      t.ok(stateB.flying, 'We are flying.')
    })    
  })
})

//Test that wildcards work: 
test('Catch all wildcard listener', (t) => {
  t.plan(4)

  stack.on('*wild', (state, next) => {
    t.pass('wildcard listener ran')
    next(null, state)
  })
  stack.fire('anything', (err, next) => {
    t.pass('anything fired')
  })
  stack.fire('anything/else', (err, next) => {
    t.pass('anything else fired too')
  })

})
