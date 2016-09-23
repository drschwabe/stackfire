var test = require('tape'), 
    stack = require('./stack.js')

test("stack.fire('/do-something') to invoke stack.on('/do-something')", (t) => {
  t.plan(2)

  stack.on('/do-something', (state, next) => {
    t.ok(state, 'listener invoked')    
    t.equal(state.req.path, '/do-something', "state.req.path equals '/do-something'")
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
    t.equal(state.req.path, '/do-another-thing', "state.req.path equals the command from the nested fire (not the original command).")    
  })
  
  //Original command: 
  stack.fire('/do-something-else')

})


test("Moon mission: fire 3 commands and verify state consistency along the way", (t) => {
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


