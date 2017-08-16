const test = require('tape-catch'), 
      requireUncached = require('require-uncached'), 
      //^ ensures a clean slate for stack for each test. 
      _ = require('underscore')
  
test("stack.fire invokes stack.on", (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')

  stack.on('/do-something', (state, next) => {
    t.ok(state, 'listener invoked')    
    t.equal(state._command.path, '/do-something', "state._command.path equals '/do-something'")
  })

  stack.fire('/do-something')

})

test("stack.fire nested within stack.on", (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')

  stack.on('/do-something-else', (state, next) => {
    console.log('do something....')
    //Nested fire: 
    stack.fire('/do-another-thing', (err, newState) => {
      debugger //< Current command is now 'do-something-else'
      //cause do-another-thing has finished.
      next()
    })
  })

  stack.on('/do-another-thing', (state, next) => {
    t.ok(state, 'root level listener invoked from a nested fire')
    t.equal(state._command.path, '/do-another-thing', "state._command.path equals the path of the current 'on' listener.")       
    next() 
  })
  
  //Original command: 
  stack.fire('/do-something-else')

})

test("stack.fire nested within stack.on (async)", (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')
  stack.on('/do-something-else', (state, next) => {
    debugger
    //Nested async fire: 
    setTimeout(() => {
      stack.fire('/do-another-thing', (err, newState) => {
        next()
      }, 1000)
    })
  })
  stack.on('/do-another-thing', (state, next) => {
    t.ok(state, 'root level listener invoked from a nested fire')
    t.equal(state._command.path, '/do-another-thing', "state._command.path equals the path of the current 'on' listener.")       
    next(null, state) 
  })
  stack.fire('/do-something-else', (err, state) => {
    setTimeout(() => {
      t.pass('reached end of the original fire')
    }, 500)
  })
})


test("fire 3 nested commands and verify state consistency along the way", (t) => {
  t.plan(6) //This will be the next major engineering hurdle; 
  //to ensure that commands that are children of children fire and return back to the 
  //root command; will wnat to make a visualization of this. 
  let stack = requireUncached('./stack.js')

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
  let stack = requireUncached('./stack.js')

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

  let stack = requireUncached('./stack.js')
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


test("(same as above, but even more complex routes using a parameter)", (t) => {

  let stack = requireUncached('./stack.js')
  stack.on('/inventory/:item/deliver', (state, next) => {
    t.ok(state, 'expected listener invoked')
    next(null, state)
  })

  //This should not run: 
  stack.on('/inventory/:item/destroy', (state, next) => {
    t.fail('listener invoked when it should not have')
    next(null, state)
  })

  stack.fire('/inventory/widget/deliver', (err, state) => {
    t.ok(state, 'end of stack reached')
    t.end()
  })

})


test("(same as above, but even more complex routes using multiple parameters)", (t) => {

  let stack = requireUncached('./stack.js')
  stack.on('/go/:destination/:time', (state, next) => {
    t.ok(state, 'expected listener invoked')
    next(null, state)
  })

  //This should not run: 
  stack.on('/some/other/route', (state, next) => {
    t.fail('listener invoked when it should not have')
    next(null, state)
  })

  stack.fire('/go/Brisbane/tomorrow', (err, state) => {
    t.ok(state, 'end of stack reached')
    t.end()
  })

})

//Test to ensure stack.state is updated as expected. 
test("stack.state integrity (and commands without listeners)", (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')
  stack.fire('/take-off', (err, state) => {
    t.equals(stack.state, state, 'stack.state equals the newly returned state')
    state.flying = true 
    stack.fire('/autopilot', (err, stateB) => {
      t.ok(stateB.flying, 'We are flying.')
    })    
  })
})

test('Catch all wildcard listener', (t) => {
  t.plan(4)
  let stack = requireUncached('./stack.js')

  stack.on('*wild', (state, next) => {
    if(state._command.path == '/_buffer') return next(null, state)
    t.pass('wildcard listener ran')
    console.log(state._command.path)
    next(null, state)
  })

  stack.fire('anything', (err, state, next) => {
    t.pass('anything fired')
    next()
  })
  
  stack.fire('anything/else', (err, state) => {
    t.pass('anything else fired too')
  })

})

test("Wildcard plays nicely with other listeners (wildcard listener established BEFORE other routes)", (t) => {
  let stack = requireUncached('./stack.js')
  t.plan(2)

  stack.on('heart', (state, next) => {
    t.fail("listener ('heart') which was never explicitly fired was invoked!")
    next(null, state)
  })

  //Establish wildcard before diamond: 
  stack.on('*wild', (state, next) => {
    console.log(state._command.path)
    if(state._command.path == '/_buffer') return next(null, state)    
    t.pass('*wild listener invoked')
    next(null, state)
  })

  stack.on('diamond', (state, next) => {
    //if(state._command.path != '/diamond') return next(null, state)        
    t.pass('diamond listener invoked')    
    next(null, state) 
  })

  stack.fire('diamond')
})

//This test is same as above, but with the wildcard listener happening after existing routes.  Results should be the same. 
test("Wildcard plays nicely with other listeners (wildcard listener established AFTER existing routes)", (t) => {

  let stack = requireUncached('./stack.js')
  t.plan(2)

  stack.on('heart', (state, next) => {
    t.fail("listener ('heart') which was never explicitly fired was invoked!")
    next(null, state)
  })

  stack.on('diamond', (state, next) => {
    t.pass('diamond listener invoked')    
    next(null, state) 
  })

  //Establish wildcard after diamond: 
  stack.on('*wild', (state, next) => {
    if(state._command.path == '/_buffer') return next(null, state)    
    t.pass('*wild listener invoked')
    next(null, state)
  })  

  stack.fire('diamond')
})

test("Wildcard correctly is added to stacks and fires in the correct order)", (t) => {

  let stack = requireUncached('./stack.js')
  t.plan(3)

  stack.on('ten', (state, next) => {
    state.counter = 10
    next(null, state)
  })
  stack.on('one', (state, next) => {
    state.counter = 1
    next(null, state)
  })
  stack.on('zero', (state, next) => {
    state.counter = 0
    next(null, state)
  })

  stack.on('*multiply', (state, next) => {
    if(state._command.path == '/_buffer') return next(null, state)
    console.log('*multiply')
    state.counter *= 10
    next(null, state)
  })

  stack.on('*multiply', (state, next) => {
    if(state._command.path == '/_buffer') return next(null, state)    
    console.log('*multiply')
    state.counter *= 10
    next(null, state)
  })

  stack.fire('ten', (err, state, next) => {
    t.equal(stack.state.counter, 1000, 'multiply called twice on ten') 
    next()   
  })
  stack.fire('zero', (err, state, next) => {
    t.equal(stack.state.counter, 0, 'zero canned with multiply is zero')
    next()
  })
  stack.fire('one', (err, state, next) => {
    t.equal(stack.state.counter, 100, 'one begets 100')
  })
})


test("Commands are agnostic to stating with a slash or not", (t) => {

  let stack = requireUncached('./stack.js')
  t.plan(5)

  stack.on('party', (state, next) => {
    t.pass("It's a party!")
    next(null, state)
  })

  stack.on('/party', (state, next) => {
    t.pass("it's the same party!")
    next(null, state)
  })  

  stack.fire('party', (err, state, next) => {
    next()
  })

  stack.on('/earthquake', (state, next) => {
    t.pass('earthquake!')
    next(null, state)
  })

  stack.on('earthquake', (state, next) => {
    t.pass('earthquake!!!!')
    next(null, state)
  })

  stack.fire('/earthquake', (err, state, next) => {
    t.pass('finished earthquake')
    next()
  })

})

test('berries', (t) => {
  t.plan(4)

  let stack = requireUncached('./stack.js')    

  t.ok(_.isArray(stack.grid.cells))

  stack.on('berry', (state, next) => {
    t.equals(stack.grid.enties[0].command.path, '/berry') 
    next(null, state)
  })

  stack.fire('berry', (err, state) => {  
    //now the fire has completed: 
    t.ok(stack.grid.enties[0].command.done)
    //next(null, state)    
  })  

  stack.fire('vegetable', (err, state) => { 
    //We check the next enty: 
    t.ok(stack.grid.enties[1].command.done)        
  }) 

})


test("A subsequent fire waits until the current stack is finished before becoming fired", (t) => {
  t.plan(3)

  let stack = requireUncached('./stack.js')  

  stack.on('warning-alarm', (state, next) => {
    console.log('you have 2 seconds to comply')
    setTimeout(()=> {
      next(null, state)
    }, 2000)  
  })

  stack.fire('warning-alarm', (err, state, next) => {
    t.pass('warning alarm finished')
    next() 
  }) 

  stack.fire('fire-turret', (err, state) => {
    console.log('fire turret!') 
    //The following should apply to state 
    //only AFTER warning alarm completes: 
    state.firing_turret = true
    //next()
  })

  //Wait one second and check: 
  setTimeout( () => {
    t.notOk(stack.state.firing_turret, 'Turret is not firing yet')
  }, 500 )

  setTimeout( () => {
    t.ok(stack.state.firing_turret, 'Turret is now firing!')    
  }, 2500)

})


test("Commands not issued should not fire (using wildcard commands)", (t) => {
  t.plan(3)

  let stack = requireUncached('./stack.js')

  //Defining a wildcard listener atop of the stack seems to result in 
  //subsequent listeners being fired even though their command was not issued...

  stack.on('*wildcard', (state, next) => {
    if(state._command.path == '/_buffer') return next(null, state)    
    t.pass('this should invoke on every fire')
    next(null, state)    
  })

  stack.on('/release-prisoner', (state, next) => {
    t.pass('expected listener invoked')
    next(null, state)
  })

  //This should not run! 
  stack.on('/execute-prisoner', (state, next) => {
    //workaround by manually checking: 
    if(state._command != '/execute-prisoner') return next(null, state)
    t.fail('listener invoked when it should not have')
    next(null, state)
  })

  stack.fire('/release-prisoner', (err, state) => {
    t.pass('end of stack reached')
    t.end()
  })

})


test("Commands not issued should not fire (using commands that use URL param)", (t) => {
  t.plan(3)

  let stack = requireUncached('./stack.js')

  stack.on('/bomb/:anything', (state, next) => {
    t.pass('this should invoke on every fire')
    next(null, state)    
  })

  stack.on('/bomb/disarm', (state, next) => {
    t.pass('expected listener invoked')
    next(null, state)
  })

  //This should not run! 
  stack.on('/bomb/detonate', (state, next) => {
    //workaround by manually checking: 
    if(state._command != '/bomb-detonate') return next(null, state)    
    t.fail('listener invoked when it should not have')
    next(null, state)
  })

  stack.fire('/bomb/disarm', (err, state) => {
    t.pass('end of stack reached')
    t.end()
  })  
})

test('Robot assembly line', (t) => {
  t.plan(3)

  let stack = requireUncached('./stack.js')

  stack.on('robot/assemble/:product', (state, next) => {
    console.log('"robot/assemble/:product" on!')    
    t.equals(state._command.path, '/robot/assemble/box')    

    stack.fire('robot/box', (err, state, next) => {
      console.log('"robot/box" fire complete')
      console.log(`state._command.path is: ${state._command.path}
      `)
      next(null, state)
    })
  })

  stack.on('robot/:product', (state, next) => {
    console.log('"robot/:product" on!')    
    console.log(`state._command.path is: ${state._command.path}
    `)  
    t.equals(state._command.path, '/robot/box')
    next(null, state)   
  })

  stack.fire('robot/assemble/box', (err, state) => {
    console.log('"robot/assemble/box" fire complete')
    t.equals(null, state._command)
  })

})


test('Async element initialization', (t) => {
  t.plan(1)
  let stack = requireUncached('./stack.js')
  let async = requireUncached('async')

  stack.on('element/init/:prefix', (state, next) => {
    var elems = ['a', 'b', 'c']
    var nextFires = []
    async.eachSeries(elems, (elem, callback) => {
      stack.fire('element/' + elem,  stack.state, (err, state, nextFire) => {
        nextFires.push(nextFire)
        callback(null)
      })
    }, (err) => {
      nextFires[0]()
    })
  })

  stack.on('element/:elementName', (state, next) => { 
    stack.fire('element/' + state._command.elementName + '/connected', function(err, newState, fireNext) {
      next(null, newState)
    })
  })

  stack.fire('element/init/my-element', (err, state, nextFire) => {
    t.pass('Finished')
  })
})


test('Fire shorthand', (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')

  stack.on('green', (state, next) => {
    t.pass('green light')
    stack.fire('go', next) //< Shortand
  })

  stack.on('go', (state, next) => {
    t.pass('going')
    next()
  })  

  stack.fire('green', (err, state, nextFire) => {
    t.pass('gone')
  })

})

test('Fire shorthand + multi commands', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')

  stack.on('green', (state, next) => {
    t.pass('green light on')
    stack.fire('go', next)
  })

  stack.on('go', (state, next) => {
    t.pass('going')
    next()
  })

  stack.fire('green', (err, state, nextFire) => {
    t.pass('gone')
  })

  stack.on('red', (state, next) => {
    t.pass('red light on')
    next()
  })  

  stack.fire('red', (err, state, nextFire) => {
    t.pass('stopped')
  })

})

test('command nulls after fire', (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')  
  stack.on('bake-cookie', (state, next) => {
    t.ok(state._command, 'bake-cookie')
    next()
  })
  stack.fire('bake-cookie', (err, state, nextFire) => {
    t.equals(null, state._command, 'command finished/is null')
  })
})


test('buffer fires every fire', (t) => {
  t.plan(6)
  let stack = requireUncached('./stack.js')  
  stack.on('apples', (state, next) => {
    t.pass('apples on!')
    next(null, state)
  })
  stack.on('oranges', (state, next) => {
    t.pass('oranges on!')
    next(null, state)
  })  
  stack.on('/_buffer', (state, next) => {
    console.log('/buffer')
    t.pass('/_buffer on!') //< Should run twice.
    next(null, state)
  })
  stack.fire('apples', (err, state, next) => {
    t.pass('apples fire ran OK')
    next()
  })
  stack.fire('oranges', (err, state, next) => {
    t.pass('oranges fire ran OK')
  })
})

test('buffer fires every fire (complex)', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')  
  stack.on('apples', (state, next) => {
    t.pass('apples on!')
    stack.fire('oranges', (err, state) => {
      t.pass('oranges fire ran OK')
      next(null, state)
    })
  })
  stack.on('/_buffer', (state, next) => {
    t.pass('/_buffer on!') //< Should run twice
    next(null, state)
  })
  stack.on('oranges', (state, next) => {
    console.log('oranges on!')
    next(null, state)
  })
  stack.fire('apples', (state, next) => {
    t.pass('apples fire ran OK')
  })
})
