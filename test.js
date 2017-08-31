const test = require('tape-catch'), 
      requireUncached = require('require-uncached'), 
      //^ ensures a clean slate for stack for each test. 
      _ = require('underscore'), 
      log = console.log

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
  t.plan(3)
  let stack = requireUncached('./stack.js')

  stack.on('/apple', (state, next) => {
    console.log('/apple "on" (middleware in progress). _command.path:')
    console.log(stack.state._command.path)    
    stack.fire('/bannana', (err, newState, nextFire) => {
      console.log('/bannana fired (its final callback in progress)')
      console.log(stack.state._command.path)     
      console.log("/bannana's callback will immediately call stack.next()")   
      debugger
      stack.next() //Maybe can solve this with calling stack.nextFire()
    })
  })

  stack.on('/bannana', (state, next) => {         
    console.log('/bannana "on" middleware in progress. _command.path:')
    console.log(stack.state._command.path) 
    t.ok(state, 'root level listener invoked from a nested fire')
    t.equal(stack.state._command.path, '/bannana', "state._command.path equals the path of the current 'on' listener.")       
    console.log('/bannana middleware will now call stack.next()')
    stack.next() 
  })

  console.log('about to fire /apple')

  stack.fire('apple', (err, state, nextFire) => {
    //something is causing the apple callback to be called twice
    // _.command.callback = _.once()  ?        
    console.log('/apple fired (its final callback in progress). _command.path:')
    console.log(stack.state._command.path)    
    t.pass('reached end of the original fire (/apple)')
    stack.next()
  })
})

test("stack.fire nested within stack.on (async)", (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')

  stack.on('/apple', (state, next) => {
    console.log('/apple "on" (middleware in progress). _command.path:')
    console.log(stack.state._command.path)    
    console.log('about to run .5 second timeout before firing /bannana...')
    //Nested async fire: 
    setTimeout(() => {
      debugger
      stack.fire('/bannana', (err, newState, nextFire) => {
        console.log('/bannana fired (its final callback in progress)')
        console.log(stack.state._command.path)     
        console.log("/bannana's callback will immediately call nextFire()")   
        debugger
        stack.next() //Maybe can solve this with calling stack.nextFire()
      })
    }, 500)
  })

  stack.on('/bannana', (state, next) => {         
    console.log('/bannana "on" middleware in progress. _command.path:')
    console.log(stack.state._command.path) 
    console.log('(this should not execute until after 0.5 seconds)')  
    t.ok(state, 'root level listener invoked from a nested fire')
    t.equal(stack.state._command.path, '/bannana', "state._command.path equals the path of the current 'on' listener.")       
    console.log('/bannana middleware will now call stack.next()')
    stack.next() 
  })

  console.log('about to fire /apple')

  stack.fire('apple', (err, state, nextFire) => {
    //something is causing the apple callback to be called twice
    // _.command.callback = _.once()  ?        
    console.log('/apple fired (its final callback in progress). _command.path:')
    console.log(stack.state._command.path)    
    console.log('about to run 1 second timeout before calling stack.next)')
    setTimeout(() => {
      t.pass('reached end of the original fire (/apple)')
      console.log('(this should not execute until after 1 seconds)')
      stack.next()
    }, 1000)
  })
})


test("fire three nested commands and verify state consistency along the way", (t) => {
  t.plan(6) //This will be the next major engineering hurdle; 
  //to ensure that commands that are children of children fire and return back to the 
  //root command; will wnat to make a visualization of this. 
  let stack = requireUncached('./stack.js')

  stack.on('/land-on-moon', (state, next) => {
    state.landed = true
    t.ok(state.landed, 'landed on moon') 
    //Second command fired: 
    stack.fire('/plant-flag', (err, newState, nextFire) => {
      t.ok(newState.landed, 'still landed')
      state.flagPlanted = true
      t.ok(state.flagPlanted, 'planted flag')      
      //Third command fired: 
      stack.fire('/take-picture', (err, newState, nextFire2) => {
        t.ok(newState.landed && newState.flagPlanted, 'still landed and flag remains planted')
        state.tookPicture = true 
        t.ok(state.tookPicture, 'took picture')
        nextFire2(null, state)
      })
    })
  })

  //First command fired: 
  stack.fire('/land-on-moon', (err, finalState) => {
    t.ok(finalState.landed && finalState.flagPlanted && finalState.tookPicture, 'mission complete')
  })
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
  t.plan(3)
  let stack = requireUncached('./stack.js')
  stack.on('/inventory/:item/deliver', (state, next) => {
    t.ok(state, 'expected listener invoked')
    t.ok(state._command.params.item, 'parameter is included on the command')
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
    //console.log(state._command.path)    
    debugger  
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

  stack.fire('berry', (err, state, nextFire) => {  
    //now the fire has completed: 
    t.ok(stack.grid.enties[0].command.middleware_done)
    nextFire()    
  })  

  stack.fire('vegetable', (err, state, nextFire) => { 
    //Even though no middleware, ensure this enty still exists on the grid: 
    nextFire() //< The command is not done until we call nextFire
    //(even though there are no further commands to fire)
  }) 

  t.ok(stack.grid.enties[1].command.done)    

})



test("A subsequent fire waits until the current stack is finished before becoming fired", (t) => {
  t.plan(5)

  let stack = requireUncached('./stack.js')  

  stack.on('warning-alarm', (state, next) => {
    console.log('you have 2 seconds to comply')
    setTimeout(()=> {
      next(null, state)
    }, 2000)  
  })

  stack.fire('warning-alarm', (err, state, nextFire) => {
    t.pass('warning alarm finished')
    debugger
    nextFire() 
  }) 

  stack.fire('fire-turret', (err, state, nextFire) => {
    console.log('fire turret!') 
    //The following should apply to state 
    //only AFTER warning alarm completes: 
    state.firing_turret = true
    t.ok(stack.grid.enties[1].command.middleware_done, true, 'Fire turret middleware is done.')
    //nextFire() < We don't call nextFire()
  })

  //Wait one second and check state: 
  setTimeout( () => {
    t.notOk(stack.state.firing_turret, 'Turret is not firing yet')
  }, 500 )

  //Wait 2.5 seconds and check state: 
  setTimeout( () => {
    t.ok(stack.state.firing_turret, 'Turret is now firing!')    
    t.notOk(stack.grid.enties[1].command.done, 'Fire turret command is not done cause we never called nextFire()') 
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
  t.plan(4)

  let stack = requireUncached('./stack.js')

  stack.on('robot/assemble/:product', (state) => {
    console.log('"robot/assemble/:product" on!')    
    t.equals(state._command.path, '/robot/assemble/box')    

    stack.fire('robot/box', (err, state) => {
      console.log('"robot/box" fire complete')
      console.log(`state._command.path is: ${state._command.path}
      `)
      stack.next()
    })
  })

  stack.on('robot/:product', (state) => {
    console.log('"robot/:product" on!')    
    console.log(`state._command.path is: ${state._command.path}
    `)  
    t.equals(state._command.path, '/robot/box')
    stack.next()   
  })

  stack.fire('robot/assemble/box', (err, state) => {
    console.log('"robot/assemble/box" fire complete')
    debugger
    t.equals(state._command.path, '/robot/assemble/box')
    stack.next()
  })

  t.equals(stack.state._command, null)

})


test('Async element initialization', (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')
  let async = requireUncached('async')

  stack.on('element/init/:prefix', (state) => {
    var elems = ['my-elem-a', 'my-elem-b', 'my-elem-c']
    //var nextFires = []
    console.log('on: ' + state._command.path)    
    async.eachSeries(elems, (elem, callback) => {
      //callback(null)
      stack.fire('element/' + elem,  stack.state, (err, state, nextFire) => {
        //nextFires.push(nextFire)
        //nextFire(null, callback)
        console.log('fired: ' + state._command.path)        
        stack.next(callback)    
      })
    }, (err) => {
      //nextFires[0]()
      t.pass('done eachSeries')
     //debugger
      stack.next()
    })
    // elems.forEach((elem) => {
    //   stack.fire('element/' + elem,  stack.state, (err, state, nextFire) => {
    //     //nextFires.push(nextFire)
    //     //callback(null)
    //     //nextFire()
    //     nextFire()    
    //   })
    // })
    //next(null, state)
  })

  stack.on('element/:elementName', (state) => { 
    log('on: ' + state._command.path)        
    //Got a problem with this matching "/element/init/my-element"
    //temporary workaround: 
    //if(!state._command.elementName) return next(null, state)
    //console.log('on: ' + state._command.path)
    stack.fire('element/' + state._command.params.elementName + '/connected', function(err, newState) {
      //next(null, newState) //< If you call next here we get a failure. 
      //TODO: should be some brakes when the next() command fires; some extra logic to prevent max callback.
      console.log('fired: ' + state._command.path)
      stack.next()
      //next(null, newState)
    })
  })

  //Problem here, nothing happens..
  // stack.on('element/c', (state, next) => {
  //   t.pass('element/c fired OK!')
  //   next(null, state)
  // })

  stack.fire('element/init/my-element', (err, state) => {
    log('fired: ' + state._command.path)
    t.pass('Finished')
    stack.next()
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

  stack.on('green', (state) => {
    t.pass('green light on')
    stack.fire('go')
  })

  stack.on('go', (state) => {
    t.pass('going')
    stack.next()
  })

  stack.fire('green', (err, state) => {
    t.pass('gone')
    stack.next()
  })

  stack.on('red', (state) => {
    t.pass('red light on')
    stack.next()
  })  

  stack.fire('red', (err, state) => {
    t.pass('stopped')
  })

})

test('command nulls after fire', (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')  
  stack.on('bake-cookie', (state) => {
    t.ok(state._command, 'bake-cookie')
    stack.next()
  })
  stack.fire('bake-cookie', (err, state) => {
    stack.next()
  })
  t.equals(null, stack.state._command, 'command finished/is null')
})


test.skip('buffer fires every fire', (t) => {
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

test.skip('buffer fires every fire (complex)', (t) => {
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


// test.only('ensure buffers dont fire more than they need too', (t) => {
//   t.plan(3)
//   let stack = requireUncached('./stack.js')  

//   stack.on('/_buffer', (state, next) => {
//     console.log('buffer fired')
//     t.pass()
//     next()
//   })

//   stack.on('a', (state, next) => {

//     stack.fire('1', (err, state) => {
//       next(null, state)
//     })

//   })

//   stack.on('a', (state, next) => {   

//     stack.fire('2', () => {
//       next(null, state)
//     })

//   })

//   stack.fire('a', () => {
//     t.pass('Test finished')
//   })

// })


//This isnt working: 
    //  stack.fire('element/mf-docs/rendered', next)
//but this does: 
//       stack.fire('element/mf-docs/rendered', (err, state) => {
//         next(null, state)
//       })

// So need a test to expose this issue, and to fix it. 


test.skip('Demonstrate multiple ways of calling next (WIP)', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')  

  stack.on('shake', (state, next) => {
    //The shake command is not done yet: 
    t.notOk( _.find(stack.grid.enties, (enty) => enty.command.path == 'shake').done)
    console.log('we are making a milk shake')
  })  

  stack.fire('milk', (err, state, nextFire) => {
    //The milk command is done: 
    t.ok( _.find(stack.grid.enties, (enty) => enty.command.path == 'milk').done)    
    stack.fire('shake', (err, state, nextFire) => {
      nextFire()
    })
  })

  stack.on('tonic', (state, next) => {
    //The shake command is not done yet: 
    t.notOk( _.find(stack.grid.enties, (enty) => enty.command.path == 'shake').done)
    console.log('we are making a milk shake')
  })  

  stack.fire('gin', (err, state, nextFire) => {
    //The milk command is done: 
    t.ok( _.find(stack.grid.enties, (enty) => enty.command.path == 'milk').done)    
    stack.fire('tonic', next)
  })

  stack.fire('drink', (err, state) => {
    t.ok('drinking drink')
  })
  //TODO: make another thing where you just pass an 'on' next (above only shows passing of nextFire)
})

test('Multi command stress test', (t) => {
  t.plan(10)
  let stack = requireUncached('./stack.js')  
  let gg = requireUncached('gg')  

  stack.on('shake', (state) => {
    //The shake command is not done yet: 
    var shakeCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/shake').command    
    t.notOk(shakeCommand.done, 'shake command not done')

    var nextRowCell = gg.xyToIndex(stack.grid, 1, 0)
    t.equals(shakeCommand.cell, nextRowCell, 'shake command inserted to second row, first column')  //Sibling next to shake. 

    console.log('we are making a milk shake')
    stack.next()
  })  

  stack.fire('milk', (err, state) => {
    //The milk command callback is underway: 
    var milkCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/milk').command
    t.notOk(milkCommand.done, 'milk command not done yet (trailing callback underway)') 
    t.equals(milkCommand.cell, 0, 'milk command inserted to cell 0')  
    stack.fire('shake', (err, state) => {
      var shakeCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/shake').command
      //milk command is still done: 
      t.notOk(milkCommand.done, 'milk command still not done')     
      //and now shake is done too:                  
      t.notOk(shakeCommand.done, 'shake command not done (trailing callback underway)')                 
      console.log('we made a milk shake')
      stack.next()              
    })
  })

  stack.on('beer', (state, next) => {
    var beerCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/beer').command
    //The beer command is not done yet:     
    t.notOk(beerCommand.done, 'beer command not done') 
    t.equals(beerCommand.cell, gg.xyToIndex(stack.grid, 0, 1), 'beer command inserted to first row, second column (sibling of the first command)') 
    console.log('pour a beer')
    stack.next()
  })  

  stack.fire('beer', (err, state, next) => {
    var beerCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/beer')    
    t.notOk(beerCommand.done, 'beer command still not done') 
    t.equals(beerCommand.cell, gg.xyToIndex(stack.grid, 0, 1), 'beer command still at first row, second column')  //< Sibling next to milk.
    console.log('poured a beer.')
  })

})



test.skip('Strawberry milkshake', (t) => {
  t.plan(10)
  let stack = requireUncached('./stack.js')  

  stack.on('milkshake', (state, next) => {
  
    stack.fire('milk', (err, state, nextFire) => {
      console.log('add some milk')
      //nextFire()      
    })  

    stack.fire('strawberries', (err, state, nextFire) => {
      console.log('add some strawberries')
      //wow should not run! 
      //next(null, state)       
    })

  })  

  stack.fire('milkshake', (err, state) => {
    //The milk command is done: 
    console.log('finished milkshake!')
  })

})



test('Empty goldmine', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')  
  let gg = requireUncached('gg') 

  stack.state.gold = false

  stack.on('mine', (state) => {

    stack.fire('shovel', (err, state) => {
      console.log('shovel for gold...')

      var shovelCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/shovel').command

      //Parent cell should equal 0 (first cell): 
      t.equals(shovelCommand.parent.cell, 0, "shovel command's parent is at the first cell of the grid")

      //Shovel command's cell should be directly below: 
      var expectedCell = gg.xyToIndex(stack.grid, [1, 0])

      t.equals(shovelCommand.cell, expectedCell, 'shovel command is directly below the parent command')

      //This will never be true; there should be no advancement to 'cart' fire.
      if(state.gold == true) return stack.next()
    })  

    //technically stack.fire above is done... as such, we may need to use a different metric for stack.fire
    //OR we should not mark as done
    //perhaps we will say middlware_done and then command_done - command_done false until callback completed ie; nextFire called. 

    stack.fire('cart', (err, state) => {
      //Should not run...
      console.log('fill cart...')           
      t.fail('there will never be any gold!')
    })

  })  

  stack.fire('mine', (err, state) => {
    //Should not run: 
    t.fail('mining will never finish!')
  })

  setTimeout(() => {
    t.equals( stack.grid.cells[0].enties[0].command.path, '/mine', 'first cell is /mine') 
    t.equals ( stack.grid.cells[gg.xyToIndex(stack.grid, [1,0])].enties[0].command.path, '/shovel', 'next row down, same column is /shovel' )
    t.equals( stack.grid.cells[gg.xyToIndex(stack.grid, [1,1])].enties[0].command.path, '/cart', 'next column over is /cart (it is sibling so shares same row)')       
  }, 100)

})

test('Incomplete garden', (t) => {
  t.plan(4)
  let stack = requireUncached('./stack.js') 
  let gg = requireUncached('gg')    

  stack.fire('dig', (err, state, nextFire) => {
    log('dug')
    t.pass('dig complete, we done for the day')
    //nextFire is not called, so no other commands should run.
  })

  stack.fire('plant', (err, state, nextFire) => {
    log('planted')
    t.fail('there are no plants!')
  })

  stack.fire('water', (err, state, nextFire) => {
    log('watered')
    t.fail('there is no water!')
  })

  setTimeout(() => { //Ensure each of the commands exist on the first row: 
    t.equals( stack.grid.cells[0].enties[0].command.path, '/dig', 'first cell is /dig') 
    t.equals ( stack.grid.cells[gg.xyToIndex(stack.grid, [0,1])].enties[0].command.path, '/plant', 'next column over is /plant' )
    t.equals( stack.grid.cells[gg.xyToIndex(stack.grid, [0,2])].enties[0].command.path, '/water', 'next column after that is /water')         
  }, 100)

  //Future shorthand: 
  //stack.chain().fire('dig').fire('plant').fire('water') 
  //normally you would have to call 'nextFire' but when in a chain they fire automatically
  //possibly could rename to stack.autoFire()
  //or stack.auto('')
  //stack.parallel()
  //maybe I should remove callbacks from fires... 
  //that way ... nah... or how about remove nested ... nah

})


test('Complete garden', (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')  

  stack.fire('dig', (err, state, nextFire) => {
    log('dug')
    t.pass('dig complete, we done for the day')
    //nextFire()
    nextFire(null, state)
    //nextFire called, so the next command runs: 
  })

  stack.fire('plant', (err, state, nextFire) => {
    log('planted')
    t.pass('today we have plants!')
    nextFire()
  })

  stack.fire('water', (err, state, nextFire) => {
    log('watered')
    t.pass('and water!')
  })

})

test.only('Multiple .on with same name', (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')  

  stack.on('water', () => {
    t.pass('flowing...')
    stack.next()
  })

  stack.on('water', () => {
    t.pass('still flowing...')
    stack.next()
  })  

  stack.fire('water')
})
