const test = require('tape-catch'),
      requireUncached = require('require-uncached'),
      //^ ensures a clean slate for stack for each test.
      _ = require('underscore'),
      log = console.log

//Export tests a module so all of the tests are available for consumption
//by other modules or tools:
var testObj = {
  tests : [],
  //Run tests unless the param is provided
  //(typically when required/consumed by another module)
  queue : (run, testName) => {
    //Prepare an array and function for populating it with tests
    var newTest = (testName, testFunc) => {
      testObj.tests.push({
        name : testName,
        func : (testName) => {
          test(testName, testFunc)
        }
      })
    }
    newTest.only = (testName, testFunc) => {
      testObj.only = {
        name : testName,
        func : (testName) => {
          test(testName, testFunc)
        }
      }
    }
    //^ if run == true we will loop over this to perform
    //the tests

    //Now write each test as normal, but call it with queuing function:
    newTest("stack.fire invokes stack.on", (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/do-something', () => {
        t.ok(stack.state, 'listener invoked and stack state established')
        t.equal(stack.path, '/do-something', "state.path equals '/do-something'")
      })

      stack.fire('/do-something')

    })


    newTest("Mulitiple listeners invoke in a series (not parallel)", (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/boot', () => {
        t.ok(stack.path == '/boot', 'first boot listener ran')
        stack.state.booting = true
      })

      stack.on('/boot', () => {
        t.ok(stack.path == '/boot', 'second boot listener ran')
        t.ok(stack.state.booting, 'variable set on state during first listener exists with expected value')
      })

      stack.fire('/boot')
    })

    newTest("Mulitiple listeners are placed in the same column of the grid (not on row)", (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/boot', () => {
        t.ok(stack.path == '/boot', 'first boot listener ran')
      })

      stack.on('/boot', () => {
        t.ok(stack.path == '/boot', 'second boot listener ran')
      })

      stack.on('/boot', () => {
        t.ok(stack.path == '/boot', 'third boot listener ran')
      })

      stack.fire('/boot')

      //Verify each listener (grid enty) exists at cells 0, 3, and 6
      t.ok(stack.grid.enties[0].cell == 0 && stack.grid.enties[1].cell == 3 && stack.grid.enties[2].cell == 6, 'Each listener exist in the same column')
      //ie:
      //0 x x
      //3 x x
      //6 x x
    })

    newTest("Different commands align into different columns (and fire in order)", (t) => {
      t.plan(7)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/boot', () => t.ok(stack.path == '/boot', 'first boot listener ran'))

      stack.on('/boot', () => {
        t.pass('second boot listener ran')
        t.equal(stack.path, '/boot', 'path is /boot')
      })

      stack.on('/boot', () => {
        t.pass('third boot listener ran')
        t.equal(stack.path, '/boot', 'path is /boot')
      })

      stack.on('/strap', () => t.ok(stack.path == '/strap', 'first "strap" listener ran'))

      stack.on('/strap', () => t.ok(stack.path == '/strap', 'second "strap" listener ran'))

      stack.fire('/boot')

      stack.fire('/strap')
    })

    newTest("stack.fire nested within stack.on", (t) => {
      t.plan(5)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/apple', (next) => {
        console.log('/apple "on" (listener function in progress).')
        t.equal(stack.path, '/apple', "state.path equals the path of the current 'on' listener.")
        //stack.fire('/bannana', (next) => next)
        next.fire('/bannana')
      })

      stack.on('/bannana', () => {
        console.log('/bannana "on" listener in progress. state.path:')
        console.log(stack.path)
        t.ok(stack.state, 'root level listener invoked from a nested fire')
        t.equal(stack.path, '/bannana', "state.path equals the path of the current 'on' listener.")
        //next()
        //at this point, apple should be done too
      })
      console.log('about to fire /apple')
      stack.fire('apple')
      t.ok( stack.grid.cells[0].enties[0].done , 'Original command is immediately done')
      setTimeout( () => {
        t.ok( stack.grid.cells[0].enties[0].done , 'Original command is done (after checking again with some setTimeout delay)')
      }, 2)
    })

    newTest("stack.fire nested within stack.on (complex)", (t) => {
      t.plan(13)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')


      stack.on('orange', () => {
        console.log('/orange "on" (listener function in progress)')
        t.ok(stack.path, '/orange')
      })

      stack.on('orange', () => {
        console.log('/orange again')
        t.ok(stack.path, '/orange')
      })

      stack.on('orange', (next) => {
        console.log('/orange yet again!')
        t.ok(stack.path, '/orange')
        //next(  stack.fire('grapefruit') )
        next.fire('grapefruit')
      })

      stack.on('/grapefruit', () => {
        console.log('/grapefruit "on" listener in progress.')
        t.ok(stack.state, 'root level listener invoked from a nested fire')
        t.ok(stack.path, '/grapefruit')
        //next()
      })

      stack.on('/grapefruit', () => {
        console.log('/grapefruit again')
        t.equal(stack.path, '/grapefruit', "state.path equals the path of the current 'on' listener.")
        //next()
      })

      stack.on('orange', () => {
        console.log('/orange again (should occur after grapefruit listeners)')
        t.ok(stack.path, '/orange')

        t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [4,0]), 'orange first listener after grapefruit command assigned to correct cell')
      })

      stack.on('orange', () => {
        console.log('/orange last time!')
        t.ok(stack.path, '/orange')
        t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [5,0]), 'orange second listener after grapefruit assigned to correct cell')
      })

      console.log('about to fire /orange')
      stack.fire('orange')

      t.equal(stack.grid.cells[13].enties[0].command.route.spec, '/grapefruit')
      t.equal(stack.grid.cells[19].enties[0].command.route.spec, '/grapefruit' )

      t.ok( _.every(stack.commands, (command) => command.done), 'all commands are done')

    })

    newTest("stack.fire nested within stack.on (complex 2)", (t) => {
      t.plan(11)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('strawberry', () => {
        console.log('/strawberry "on" (listener function in progress)')

      })

      stack.on('orange', () => {
        console.log('/orange "on" (listener function in progress)')
        t.ok(stack.path, '/orange')
      })

      stack.on('orange', () => {
        console.log('/orange again')
        t.ok(stack.path, '/orange')
      })

      stack.on('orange', (next) => {
        console.log('/orange yet again!')
        t.ok(stack.path, '/orange')
        next.fire('grapefruit')
      })

      stack.on('/grapefruit', () => {
        console.log('/grapefruit "on" listener in progress.')
        t.ok(stack.state, 'root level listener invoked from a nested fire')
      })

      stack.on('/grapefruit', () => {
        console.log('/grapefruit again')
        t.equal(stack.path, '/grapefruit', "state.path equals the path of the current 'on' listener.")
      })

      stack.on('orange', () => {
        console.log('/orange again (should occur after grapefruit listeners)')
        t.ok(stack.path, '/orange')
        t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [4,1]), 'orange first listener after grapefruit command assigned to correct cell')
      })

      stack.on('orange', () => {
        console.log('/orange last time!')
        t.ok(stack.path, '/orange')
        t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [5,1]), 'orange second listener after grapefruit assigned to correct cell')
      })

      console.log('about to fire /strawberry')
      stack.fire('strawberry')

      console.log('about to fire /orange')
      stack.fire('orange')

      t.equal(stack.grid.cells[14].enties[0].command.route.spec, '/grapefruit')
      t.equal(stack.grid.cells[20].enties[0].command.route.spec, '/grapefruit')

    })


    newTest("stack.fire nested within stack.on, which was nested in another stack.on", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(3)
      stack.on('green', (next) => {
        t.pass("green listener's callback invoked")
        next.fire('blue')
      })

      stack.on('blue', (next) => {
        t.pass("blue listener's callback invoked")

        next.fire('red')
      })

      stack.on('red', () => {
        t.pass("red listener's callback invoked")
      })

      stack.fire('green')

    })


    newTest("stack.fire nested within stack.on, which was nested in another stack.on (complex)", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(9)

      stack.on('green', () => {
        t.pass("green listener's first callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's second callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's third callback invoked")
      })

      stack.on('green', (next) => {
        t.pass("green listener's fourth callback invoked")
        next.fire('blue')
      })

      stack.on('green', () => {
        t.pass("green listener's last callback invoked")
        //TODO:  another test to ensure blue and red commands finished
      })

      stack.on('blue', () => {
        t.pass("blue listener's first callback invoked")
      })

      stack.on('blue', () => {
        t.pass("blue listener's second callback invoked")
      })

      stack.on('blue', (next) => {
        t.pass("blue listener's third callback invoked")
        next.fire('red')
      })

      stack.on('red', () => {
        t.pass("red listener's callback invoked")
      })

      stack.fire('green')


    })

    newTest("stack.fire nested spiderweb", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(11)

      stack.on('green', () => {
        t.pass("green listener's first callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's second callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's third callback invoked")
      })

      stack.on('green', (next) => {
        t.pass("green listener's fourth callback invoked")
        next.fire('blue')
      })

      stack.on('green', () => {
        t.pass("green listener's last callback invoked")
        //TODO:  another test to ensure blue and red commands finished
      })

      stack.on('blue', () => {
        t.pass("blue listener's first callback invoked")
      })

      stack.on('blue', () => {
        t.pass("blue listener's second callback invoked")
      })

      stack.on('blue', (next) => {
        t.pass("blue listener's third callback invoked")

        next.fire('red')
      })

      stack.on('red', () => {
        t.pass("red listener's callback invoked")
      })

      stack.on('red', () => {
        t.pass("red listener's second callback invoked")
      })

      stack.on('red', () => {
        t.pass("red listener's third callback invoked")
      })

      stack.fire('green')

    })





    newTest('stack.fire can be supplied with a callback (plus a listner)', (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(2)

      stack.on('test', () => {
        t.pass('listener invoked')
      })

      stack.fire('test', () => {
        t.pass('callback is executed')
      })

    })

    newTest("stack.fire can be fired from another fire callback", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(3)

      stack.on('purple', () => {
        t.pass("purple listener's callback executed")
      })

      stack.on('pink', () => {
        t.pass("pink listener's callback executed")
      })

      stack.fire('purple', (next) => {
        t.pass('purple callback is executed')
        next.fire('pink')
      })

    })

    newTest('basic async example', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      var firstSip = (next) => {
        stack.state.listener = 'first'
        setTimeout(() => {
          console.log('first sip (takes 100 ms)')
          t.equals(stack.state.listener, 'first')
          next()
        }, 100)
      }

      var secondSip = (next) => {
        stack.state.listener = 'second'
        setTimeout(() => {
          console.log('second sip (takes 200 ms)')
          t.equals(stack.state.listener, 'second')
          next()
        }, 200)
      }

      var thirdSip = (next) => {
        stack.state.listener = 'third'
        setTimeout(() => {
          console.log('third sip (takes 300 ms)')
          t.equals(stack.state.listener, 'third')
        }, 300)
      }

      stack.on('sip latte', firstSip)

      stack.on('sip latte', secondSip)

      stack.on('sip latte', thirdSip)

      stack.fire('sip latte')

      setTimeout(() => {
        //check that the functions are placed in the same order:
        t.equals( stack.grid.enties[0].func.toString(), firstSip.toString() )
        t.equals( stack.grid.enties[1].func.toString(), secondSip.toString() )
        t.equals( stack.grid.enties[2].func.toString(), thirdSip.toString() )
      }, 700)

    })

    newTest('Presence of next param in cb fn determines if to be async or not', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      var executeSyncly = () => console.log('executed syncly')
      var executeAsyncly = (next) => setTimeout( () => {
        console.log('executed asyncly')
        next()
      }, 300)

      var executeSynclyAgain = () => console.log('executed syncly (again)')

      var executeAsynclyButDontCallNext = (next) => setTimeout( () => {
        console.log('executed asyncly')
      }, 300)

      var dontExecuteEver = () => t.fail('should not have executed')

      stack.on('go', executeSyncly )
      stack.on('go', executeAsyncly )
      stack.on('go', executeSynclyAgain )
      stack.on('go', executeAsynclyButDontCallNext )
      stack.on('go', dontExecuteEver )

      stack.fire('go')
      setTimeout(() => {
        t.pass()
      }, 700)
    })

    newTest("stack.fire nested within stack.on (async)", (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/apple', () => {

        console.log('/apple "on" (middleware in progress).  state.path:')
        console.log(stack.path)
        console.log('about to run .5 second timeout before firing /bannana...')
        //Nested async fire:
        setTimeout(() => {

          stack.fire('/bannana', () => {
            t.pass('/bannana reaches its callback')
            console.log('/bannana fired (its final callback in progress)')
            console.log(stack.path)
            console.log("/bannana's callback will immediately call nextFire()")
          })
        }, 500)
      })


      stack.on('/bannana', () => {
        console.log('/bannana "on" middleware in progress. state.path:')
        console.log(stack.path)
        console.log('(this should not execute until after 0.5 seconds)')
        t.ok(stack.state, 'root level listener invoked from a nested fire')
        t.equal(stack.path, '/bannana', "state.path equals the path of the current 'on' listener.")
        console.log('/bannana middleware will now call stack.next()')
        //stack.next()

      })

      console.log('about to fire /apple')


      stack.fire('apple', () => {

        //something is causing the apple callback to be called twice
        // _.command.callback = _.once()  ?
        console.log('/apple fired (its final callback in progress). state.path:')
        console.log(stack.path)
        console.log('about to run 1 second timeout before calling stack.next)')
        setTimeout(() => {
          t.pass('reached end of the original fire (/apple)')
          console.log('(this should not execute until after 1 seconds)')
          //stack.next()
        }, 1000)
      })
    })


    newTest("fire three nested commands and verify state consistency along the way", (t) => {
      t.plan(6) //This will be the next major engineering hurdle;
      //to ensure that commands that are children of children fire and return back to the
      //root command; will wnat to make a visualization of this.
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/land-on-moon', () => {
        stack.state.landed = true
        t.ok(stack.state.landed, 'landed on moon')
        //Second command fired:
        stack.fire('/plant-flag', (err) => {
          t.ok(stack.state.landed, 'still landed')
          stack.state.flagPlanted = true
          t.ok(stack.state.flagPlanted, 'planted flag')
          //Third command fired:
          stack.fire('/take-picture', (err) => {
            t.ok(stack.state.landed && stack.state.flagPlanted, 'still landed and flag remains planted')
            stack.state.tookPicture = true
            t.ok(stack.state.tookPicture, 'took picture')
          })
        })
        //TODO - test grid placement
      })

      //First command fired:
      stack.fire('/land-on-moon')

      t.ok(stack.state.landed && stack.state.flagPlanted && stack.state.tookPicture, 'mission complete')
    })


    newTest("Different command listeners should not fire from a single command", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(2)

      stack.on('/go', () => {
        t.equals(stack.path, '/go', 'expected listener invoked')
      })

      //This should not run:
      stack.on('/stop', () => {
        t.fail('listener invoked when it should not have')
      })

      stack.fire('/go', () => {
        t.pass('callback invoked')
      })

      //TODO - check grid placement, ensure the /go fire callback executes last

    })

    newTest("(same as above, but more complex route)", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(2)

      stack.on('/go/somewhere', () => {
        t.equals(stack.path, '/go/somewhere', 'expected listener invoked')
      })

      //This should not run:
      stack.on('/stop/something', () => {
        t.fail('listener invoked when it should not have')
      })

      stack.fire('/go/somewhere', (err) => {
        t.pass('callback invoked')
      })

    })

    test.skip("(same as above, but even more complex routes using a parameter)", (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/inventory/:item/deliver', () => {

        t.equals(stack.path, '/inventory/widget/deliver', 'expected listener invoked')
        t.ok(stack.state.params.item, 'parameter is included on the command')
      })

      //This should not run:
      stack.on('/inventory/:item/destroy', () => {
        t.fail('listener invoked when it should not have')
      })

      stack.fire('/inventory/widget/deliver', () => {
        t.pass('end of stack reached')
      })

    })


    test.skip("(same as above, but even more complex routes using multiple parameters)", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(2)

      stack.on('/go/:destination/:time', () => {
        t.equals(stack.path, '/go/Brisbane/tomorrow', 'expected listener invoked')
      })

      //This should not run:
      stack.on('/some/other/route', () => {
        t.fail('listener invoked when it should not have')
      })

      stack.fire('/go/Brisbane/tomorrow', () => {
        t.pass('end of stack reached')
      })

    })

    //Test to ensure stack.state is updated as expected.
    newTest("stack.state integrity (and commands without listeners)", (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.fire('/take-off', (next) => {
        t.equals(stack.state, stack.state, 'stack.state equals the newly returned state')
        stack.state.flying = true
        next.fire('/autopilot', () => {
          t.ok(stack.state.flying, 'We are flying.')
        })
      })
    })

    newTest('Catch all wildcard listener', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/*wild', () => {
        t.pass('wildcard listener ran')
      })

      stack.fire('anything')

    })

    newTest('Wildcard listener after specific string', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('green/*wild', () => {
        t.pass('green wildcard listener ran')
      })

      stack.fire('not green')
      stack.fire('green/giant')
      stack.fire('red/devil')
    })


    newTest('Catch all wildcard listener (wildcard listener defined after specific listener)', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('anything', () => {
        t.pass('specific listener ran')
        //t.equals(stack.path, '/anything')

      })

      stack.on('*wild', () => {
        t.pass('wildcard listener ran')
        //t.equals(stack.path, '/anything')

      })

      stack.fire('anything')

      //should result in a 2x2 grid
      // [ /anything , 1  ]
      // [ /wild ,     3]

      //The command route spec should be '/anything' for both listeners:
      //t.equals( stack.grid.cells[0].enties[0].command.route.spec, '/anything' )
      //t.ok( stack.grid.cells[1].enties[0].length )
      //t.equals( stack.grid.cells[1].enties[0].command.route.spec, '/anything' )

      //t.equals( stack.grid.cells[0].enties[0].command.listeners[0].path, '/*wild' )
      //t.equals( stack.grid.cells[2].enties[0].command.listeners[0].path, '/anything' )

      //t.equals( stack.grid.cells[0].enties[0].command.route.spec, '/anything' )

    })

    newTest('Catch all wildcard listener (using callbacks)', (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('*wild', () => {
        t.pass('wildcard listener ran')
      })

      stack.fire('anything', () => {
        t.pass('anything fired')
      })

      stack.fire('anything/else', () => {
        t.pass('anything else fired too')
      })

    })

    test.skip("Wildcard plays nicely with other listeners (wildcard listener established BEFORE other routes)", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(2)

      stack.on('heart', () => {
        t.fail("listener ('heart') which was never explicitly fired was invoked!")
      })

      //Establish wildcard before diamond:
      stack.on('*wild', () => {
        console.log(stack.path)
        t.pass('*wild listener invoked')
      })

      stack.on('diamond', () => {
        //if(state._command.route.spec != '/diamond') return next(null, state)
        t.pass('diamond listener invoked')
      })

      stack.fire('diamond')
    })

    //This test is same as above, but with the wildcard listener happening after existing routes.  Results should be the same.
    newTest("Wildcard plays nicely with other listeners (wildcard listener established AFTER existing routes)", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(2)

      stack.on('heart', () => {
        t.fail("listener ('heart') which was never explicitly fired was invoked!")
      })

      stack.on('diamond', () => {
        t.pass('diamond listener invoked')
      })

      //Establish wildcard after diamond:
      stack.on('*wild', () => {
        t.pass('*wild listener invoked')
      })

      stack.fire('diamond')
    })

    newTest("Wildcard correctly is added to stacks and fires in the correct order", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(3)

      stack.on('ten', () => {
        stack.state.counter = 10
      })
      stack.on('one', () => {
        stack.state.counter = 1
      })
      stack.on('zero', () => {
        stack.state.counter = 0
      })

      stack.on('*multiply', () => {
        console.log('*multiply')
        stack.state.counter *= 10
      })

      stack.on('*multiply', () => {
        console.log('*multiply')
        stack.state.counter *= 10
      })

      stack.fire('ten', () => {
        t.equal(stack.state.counter, 1000, 'multiply called twice on ten')
      })
      stack.fire('zero', () => {
        t.equal(stack.state.counter, 0, 'zero canned with multiply is zero')
      })
      stack.fire('one', () => {
        t.equal(stack.state.counter, 100, 'one begets 100')
      })
    })

    newTest("Wildcard value stored on stack.params.wild correctly", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)
      stack.on('vegetable/*typeOfVeggie', () => {
        t.equals(stack.params.wild, 'carrot')
      })
      stack.fire('vegetable/carrot')
    })

    newTest("Commands are agnostic to stating with a slash or not", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(5)

      stack.on('party', () => {
        t.pass("It's a party!")
      })

      stack.on('/party', () => {
        t.pass("it's the same party!")
      })

      stack.fire('party')

      stack.on('/earthquake', () => {
        t.pass('earthquake!')
      })

      stack.on('earthquake', () => {
        t.pass('earthquake!!!!')
      })

      stack.fire('/earthquake', () => {
        t.pass('finished earthquake')
      })

    })


    newTest('berries', (t) => {
      t.plan(5)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.ok(_.isArray(stack.grid.cells))

      stack.on('berry', () => {
        t.equals(stack.grid.enties[0].command.route.spec, '/berry')
      })

      stack.fire('berry', () => {
        //now the fire has completed:
        //t.ok(stack.grid.enties[0].command.middleware_done)
        t.pass()
      })

      stack.fire('vegetable', () => {
        //Even though no middleware, ensure this enty still exists on the grid:
        t.pass('fired vegetable')
      })

      t.ok(stack.grid.enties[1].command.done)
    })

    newTest("When a completed command is fired for the 2nd time, its callbacks all correctly re-enter the grid but in a new column", (t) => {
      t.plan(6)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')


      stack.on('apple', () => {
        console.log('first apple callback')
      })

      stack.on('apple', () => {
        console.log('2nd apple callback')
      })

      stack.on('apple', () => {
        console.log('third apple callback')
      })

      stack.fire('apple')

      stack.fire('apple')

      // [  apple   apple  ]
      // [  apple   apple  ]
      // [  apple   apple  ]

      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [0,0]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [1,0]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [2,0]) ].enties[0].command.route.spec, '/apple' )

      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [0,1]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [1,1]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [2,1]) ].enties[0].command.route.spec, '/apple' )

    })


    newTest('stack.fire invoked with a path which has no listeners results in a one time listener being inserted into grid', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.fire('silence', () => {
        console.log('no listeners except for this callback')
      })

      t.ok(stack.grid.cells[0].enties[0] && stack.grid.cells[0].enties[0].command.route.spec == '/silence')

      t.pass()

    })

    newTest("A subsequent fire waits until the current stack is finished before becoming fired", (t) => {
      t.plan(4)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('warning-alarm', (next) => {
        console.log('you have 2 seconds to comply')
        setTimeout(()=> {
          console.log('wait 2 seconds')
          //stack.next()
          next()
        }, 2000)
      })

      stack.fire('warning-alarm', () => {
        t.pass('warning alarm finished')
        //stack.next()
      })

      stack.fire('fire-turret', (next) => {
        console.log('fire turret!')
        //The following should apply to state
        //only AFTER warning alarm completes:
        stack.state.firing_turret = true
        //t.ok(stack.grid.enties[1].command.middleware_done, true, 'Fire turret middleware is done.')
        //next()
      })

      //Wait one second and check state:
      setTimeout( () => {
        t.notOk(stack.state.firing_turret, 'Turret is not firing yet')
      }, 500 )

      //Wait 2.5 seconds and check state:
      setTimeout( () => {
        t.ok(stack.state.firing_turret, 'Turret is now firing!')
        t.notOk(stack.commands[1].done, 'Fire turret command is not done cause we never called the trailing next')
      }, 2500)

    })


    test.skip("Commands not issued should not fire (using wildcard commands)", (t) => {
      t.plan(3)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      //Defining a wildcard listener atop of the stack seems to result in
      //subsequent listeners being fired even though their command was not issued...

      stack.on('*wildcard', () => {
        t.pass('this should invoke on every fire')
        //stack.next()
      })

      stack.on('/release-prisoner', () => {
        t.pass('expected listener invoked')
        //stack.next()
      })

      //This should not run!
      stack.on('/execute-prisoner', () => {
        //workaround by manually checking:
        //if(stack.path != '/execute-prisoner') return stack.next()
        t.fail('listener invoked when it should not have')
        //stack.next()
      })

      stack.fire('/release-prisoner', () => {
        t.pass('end of stack reached')
      })

    })

    //failing:
    newTest("Commands not issued should not fire (using commands that use URL param)", (t) => {
      t.plan(3)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('/bomb/:anything', () => {
        t.pass('this should invoke on every fire (involving bomb slash anything)')
        //stack.next()
      })

      stack.on('/bomb/disarm', () => {
        t.pass('expected listener invoked')
        //stack.next()
      })

      //This should not run!
      stack.on('/bomb/detonate', () => {
        //TODO: fix this; should not run
        t.fail('listener invoked when it should not have')
        //stack.next()
      })

      stack.fire('/bomb/disarm', () => {
        t.pass('end of stack reached')
      })
    })

    test.skip('Robot assembly line', (t) => {
      t.plan(4)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('robot/assemble/:product', (next) => {
        console.log('"robot/assemble/:product" on!')
        t.equals(stack.path, '/robot/assemble/box')

        stack.fire('robot/box', () => {
          console.log('"robot/box" fire complete')
          console.log(`state._command.route.spec is: ${stack.path}
          `)
          // stack.next()
          // stack.next()
        })
      })

      stack.on('robot/:product', () => {
        console.log('"robot/:product" on!')
        console.log(`state.path is: ${stack.path}
        `)
        t.equals(stack.path, '/robot/box')
        //stack.next()
      })

      stack.fire('robot/assemble/box', () => {
        console.log('"robot/assemble/box" fire complete')

        t.equals(stack.path, '/robot/assemble/box')
        //stack.next()
      })

      console.log('command is nulled?')
      t.equals(stack.path, null)

    })


    // newTest('Async element initialization', (t) => {
    //   t.plan(2)
    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack
  //stack.trimming = false
    //   let async = process.browser ? require('async') : requireUncached('async')

    //   stack.on('element/init/:prefix', () => {
    //     var elems = ['my-elem-a', 'my-elem-b', 'my-elem-c']
    //     //var nextFires = []
    //     console.log('on: ' + stack.state._command.route.spec)
    //     async.eachSeries(elems, (elem, callback) => {
    //       //callback(null)
    //       stack.fire('element/' + elem,() => {
    //         //nextFires.push(nextFire)
    //         //nextFire(null, callback)
    //         console.log('fired: ' + stack.state._command.route.spec)
    //         stack.next(callback)
    //       })
    //     }, (err) => {
    //       //nextFires[0]()
    //       t.pass('done eachSeries')
    //      //
    //       stack.next()
    //     })
    //     // elems.forEach((elem) => {
    //     //   stack.fire('element/' + elem,  stack.state, (err, state, nextFire) => {
    //     //     //nextFires.push(nextFire)
    //     //     //callback(null)
    //     //     //nextFire()
    //     //     nextFire()
    //     //   })
    //     // })
    //     //next(null, state)
    //   })

    //   stack.on('element/:elementName', () => {
    //     log('on: ' + stack.state._command.route.spec)
    //     //Got a problem with this matching "/element/init/my-element"
    //     //temporary workaround:
    //     //if(!state._command.elementName) return next(null, state)
    //     //console.log('on: ' + state._command.route.spec)
    //     stack.fire('element/' + stack.state._command.params.elementName + '/connected', () => {
    //       //next(null, newState) //< If you call next here we get a failure.
    //       //TODO: should be some brakes when the next() command fires; some extra logic to prevent max callback.
    //       console.log('fired: ' + stack.state._command.route.spec)
    //       stack.next()
    //       stack.next()  //Could be an issue with doing double calls like this though....
    //       //for an async func in particular, stack.next might get called
    //       //but without reference to the original middleware that it's intended for -
    //       //you can't necessarily move forward the stack...
    //       //which is why it may be important to pass stack.next('element/:elemnetName') here...
    //       //or stack.next('element/' + stack.state._command.params.elementName)
    //       //next(null, newState)
    //       //if you call just stack.next() it will do a general advance; but may cause issue if
    //       //you need things to execute in specific order so thats why its advisable to use stack.next('/name-of-function') or possibly another way would be to do it my original way which was to pass
    //       //the 'next' object
    //     })
    //   })

    //   //Problem here, nothing happens..
    //   // stack.on('element/c', (state, next) => {
    //   //   t.pass('element/c fired OK!')
    //   //   next(null, state)
    //   // })

    //   stack.fire('element/init/my-element', (err, state) => {
    //     log('fired: ' + stack.state._command.route.spec)
    //     t.pass('Finished')
    //     stack.next()
    //   })
    // })


    // newTest('Fire shorthand', (t) => {
    //   t.plan(3)
    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack
  //stack.trimming = false

    //   stack.on('green', () => {
    //     t.pass('green light')
    //     stack.fire('go', stack.next) //< Shortand
    //     stack.next() //< You have to call stack.next() for the ON
    //   })

    //   stack.on('go', () => {
    //     t.pass('going')
    //     stack.next()
    //   })

    //   stack.fire('green', (err, state, nextFire) => {
    //     t.pass('gone')
    //   })

    // })

    // newTest('Fire shorthand + multi commands', (t) => {
    //   t.plan(6)
    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack
  //stack.trimming = false
    //   let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

    //   stack.on('green', (state) => {
    //     t.pass('green light on')
    //     stack.fire('go', stack.next)
    //     stack.next()
    //   })

    //   stack.on('go', (state) => {
    //     t.pass('going')
    //     stack.next()
    //   })

    //   stack.fire('green', (err, state) => {
    //     t.pass('gone')
    //     stack.next()
    //   })

    //   stack.on('red', (state) => {
    //     t.pass('red light on')
    //     stack.next()
    //   })

    //   //Red should be a sibling of root...
    //   stack.fire('red', (err, state) => {
    //     t.pass('stopped')
    //   })

    //   t.equals(gg.examine(stack.grid, [0,1]).command.route.spec, '/red')

    // })

    newTest('command path nulls after fire', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      stack.on('bake-cookie', () => {
        t.ok(stack.path, '/bake-cookie')
      })
      stack.fire('bake-cookie')
      t.equals(null, stack.path, 'command path finished/is null')
    })


    test.skip('buffer fires every fire', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
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
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
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

    test.skip('Demonstrate multiple ways of calling next (WIP)', (t) => {
      t.plan(5)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('shake', (state, next) => {
        //The shake command is not done yet:
        t.notOk( _.find(stack.grid.enties, (enty) => enty.command.route.spec == 'shake').done)
        console.log('we are making a milk shake')
      })

      stack.fire('milk', (err, state, nextFire) => {
        //The milk command is done:
        t.ok( _.find(stack.grid.enties, (enty) => enty.command.route.spec == 'milk').done)
        stack.fire('shake', (err, state, nextFire) => {
          nextFire()
        })
      })

      stack.on('tonic', (state, next) => {
        //The shake command is not done yet:
        t.notOk( _.find(stack.grid.enties, (enty) => enty.command.route.spec == 'shake').done)
        console.log('we are making a milk shake')
      })

      stack.fire('gin', (err, state, nextFire) => {
        //The milk command is done:
        t.ok( _.find(stack.grid.enties, (enty) => enty.command.route.spec == 'milk').done)
        stack.fire('tonic', next)
      })

      stack.fire('drink', (err, state) => {
        t.ok('drinking drink')
      })
      //TODO: make another thing where you just pass an 'on' next (above only shows passing of nextFire)
    })

    test.skip('Multi command stress test', (t) => {
      t.plan(13)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('shake', () => {
        //The shake command is not done yet:
        var shakeCommand = _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/shake').command
        t.notOk(shakeCommand.done, 'shake command not done')

        var nextRowCell = gg.xyToIndex(stack.grid, 1, 0)
        t.equals(shakeCommand.cell, nextRowCell, 'shake command inserted to second row, first column')  //Sibling next to shake.

        console.log('we are making a milk shake')

      })

      stack.fire('milk', () => {
        //The milk command callback is underway:
        //skiping these tests for now; theorteically a fire without any listeners
        //does indeed create a new command that exists on the grid
        //so TODO; comeback to uncomment and pass these:
        //var milkCommand = _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/milk').command
        //t.notOk(milkCommand.done, 'milk command not done yet (trailing callback underway)')
        //t.equals(milkCommand.cell, 0, 'milk command inserted to cell 0')

        stack.fire('shake', () => {
          var shakeCommand = _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/shake').command
          //milk command is still done:
          t.notOk(milkCommand.done, 'milk command still not done')
          //and now shake is done too:
          t.notOk(shakeCommand.done, 'shake command not done (trailing callback underway)')
          console.log('we made a milk shake')

        })
      })

      stack.on('beer', () => {
        var beerCommand = _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/beer').command
        //The beer command is not done yet:
        t.notOk(beerCommand.done, 'beer command not done')
        t.equals(beerCommand.cell, gg.xyToIndex(stack.grid, 0, 1), 'beer command inserted to first row, second column (sibling of the first command)')
        console.log('pour a beer')
        //stack.next()
      })

      stack.fire('beer', () => {
        var beerCommand = _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/beer')
        t.notOk(beerCommand.done, 'beer command still not done')
        t.equals(beerCommand.cell, gg.xyToIndex(stack.grid, 0, 1), 'beer command still at first row, second column')  //< Sibling next to milk.
        console.log('poured a beer.')
        //stack.next()
      })

      t.equals( stack.grid.cells[ 0 ].enties[0].command.done, true) //< Orignial command.
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, 1,0) ].enties[0].command.done, true )//< Child of original.
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, 0,1) ].enties[0].command.done, true ) //< Sibling of original.

    })



    test.skip('Strawberry milkshake', (t) => {
      t.plan(10)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

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



    test.skip('Empty goldmine', (t) => {
      t.plan(5)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.state.gold = false

      stack.on('mine', () => {

        stack.fire('shovel', () => {
          console.log('shovel for gold...')

          var shovelCommand = _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/shovel').command



          //Parent cell should equal 0 (first cell):
          t.equals(shovelCommand.parent.cell, 0, "shovel command's parent is at the first cell of the grid")

          //Shovel command's cell should be directly below:
          var expectedCell = gg.xyToIndex(stack.grid, [1, 0])

          t.equals(shovelCommand.cell, expectedCell, 'shovel command is directly below the parent command')

          //This will never be true; there should be no advancement to 'cart' fire.
          if(stack.state.gold == true) return stack.next()
        })

        //technically stack.fire above is done... as such, we may need to use a different metric for stack.fire
        //OR we should not mark as done
        //perhaps we will say middlware_done and then command_done - command_done false until callback completed ie; nextFire called.

        stack.fire('cart', () => {
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
        t.equals( stack.grid.cells[0].enties[0].command.route.spec, '/mine', 'first cell is /mine')
        t.equals ( stack.grid.cells[gg.xyToIndex(stack.grid, [1,0])].enties[0].command.route.spec, '/shovel', 'next row down, same column is /shovel' )
        t.equals( stack.grid.cells[gg.xyToIndex(stack.grid, [1,1])].enties[0].command.route.spec, '/cart', 'next column over is /cart (it is sibling so shares same row)')
      }, 100)

    })

    newTest('Incomplete garden', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.fire('dig', (next) => {
        log('dug')
        t.pass('dig complete, we done for the day')
        //next is not called, so no other commands should run.
      })

      stack.fire('plant', () => {
        log('planted')
        t.fail('there are no plants!')
      })

      stack.fire('water', () => {
        log('watered')
        t.fail('there is no water!')
      })

      setTimeout(() => { //Ensure each of the commands exist on the first row:
        var rowZeroColumnZero = stack.grid.cells[0]
        t.equals( rowZeroColumnZero.enties[0].command.route.spec, '/dig', 'first cell is /dig')
        //There should be no enties in 0,1:
        var rowZeroColumnOne = stack.grid.cells[gg.xyToIndex(stack.grid, [0,1])]
        t.notOk ( rowZeroColumnOne.enties[0] )

        //0,2 should not exist:
        var rowZeroColumnTwo = stack.grid.cells[gg.xyToIndex(stack.grid, [0,2])]
        t.notOk( rowZeroColumnTwo )

        //The queue should have the following commands:
        t.equals(stack.queue[0].route.spec, '/plant')
        t.equals(stack.queue[1].route.spec, '/water')
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


    newTest('Complete garden', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.fire('dig', (next) => {
        log('dug')
        t.pass('dig complete, we done for the day')
        //nextFire()
        //nextFire(null, state)
        //nextFire called, so the next command runs:
        next()
      })

      stack.fire('plant', (next) => {
        log('planted')
        t.pass('today we have plants!')
        next()
      })

      stack.fire('water', () => {
        log('watered')
        t.pass('and water!')
      })

    })

    newTest('Multiple .on with same name', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('water', (next) => {
        t.pass('flowing...')
        next()
      })

      stack.on('water', () => {
        t.pass('still flowing...')
      })

      stack.fire('water')
    })

    test.skip('Stack shorthand advances the stack (inexplicitly calls stack.next())', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('apple', () => {
        t.pass()
        stack.next()
      })

      stack.on('bannana', () => {
        t.pass()
        stack.next()
      })

      stack.fire('apple')
      stack.fire('bannana', () => {
        t.pass()
      })
    })


    newTest('inadvertent next calls', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('init', (next) => {
        t.pass('/init on')
        console.log('initializing... takes 3 seconds...')
        setTimeout(() => {
          next()
        }, 3000)
      })

      stack.on('connect', () => {
        console.log("/connect on")
        //stack.next()
      })

      stack.fire('init', () => {
        console.log('initialization complete!')
        t.pass('/init reached callback')
        //stack.next()
      })

      stack.fire('connect', () => {
        console.log('connected! (should happen last')
        t.pass('/connect reached callback')
      })


    })



    newTest('inadvertent next calls pt2', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('bannana-shake', (next) => {
        console.log('brrshh-zzzzzze....')
        setTimeout(() => {
          next()
        }, 2000)
      })

      stack.on('cherry', () => {
        t.pass('put a cherry on top')
      })

      stack.fire('apple', (next) => {
        t.pass('apple fire callback reached')
        next.fire('bannana-shake', (next) => {
          next.fire('cherry')
        })
      })

      setTimeout(() => {
        //apple command completes cause stack.fire without callback
        //inexplicilty advance the stack:
        var firstCellCommand = gg.examine(stack.grid, [0,0]).command
        t.ok( firstCellCommand.route.spec = '/apple' &&  gg.examine(stack.grid, [0,0]).command.done, 'First command /apple is done')
      }, 3000)

    })


    newTest('inadvertent next calls pt3', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('bannana-shake', (next) => {
        console.log('brrshh-zzzzzze....')
        setTimeout(() => {
          next()
        }, 500)
      })

      stack.on('cherry', (next) => {
        t.pass('put a cherry on top')
        next()
      })


      stack.fire('apple', (next) => {
        t.pass('apple fire callback reached')
        next.fire('bannana-shake', (next) => {
         next.fire('cherry', (next) => {
            t.pass('cherry fire callback reached')
            console.log('do not finish cherry') //< By invoking a callback that does not
            //call next() we block the stack; apple will never complete.
          })
        })
      })

      setTimeout(() => {
        //apple command should not complete cause we provided a callback
        //and did not expliclitly call stack.next() to advance the stack:
        var appleCommand = gg.examine(stack.grid, [0,0]).command
        t.notOk(appleCommand.done, 'First command /apple is not done')
        var cherryListener = gg.examine(stack.grid, [1,2])
        console.log(cherryListener)
        t.ok(cherryListener.done, "Third command '/cherry', first listener  is done")
        var cherryCommand = gg.examine(stack.grid, [1,2]).command
        t.notOk(cherryCommand.done, 'Third command /cherry is not done')
      }, 600)

    })

    test.skip('rows of siblings', (t) => {
      t.plan(8)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')
      stack.fire('fruits', () => {
        stack.fire('apple')
        stack.fire('bannana')
        stack.fire('cherry')
        stack.fire('pineapple')
        stack.fire('kiwi')
        stack.fire('watermellon')
        //stack.next() //< we do not call,
        //therefore the fruits command should never complete
      })

      //1 parent, and row of 6 siblings:
      //fruits
      //apple | bannana | cherry | pineapple | kiwi | watermellon

      t.equals(gg.examine(stack.grid, 0).command.route.spec, '/fruits' )
      t.notOk(gg.examine(stack.grid, 0).command.done)
      t.equals(gg.examine(stack.grid, [1,0]).command.route.spec, '/apple' )
      t.equals(gg.examine(stack.grid, [1,1]).command.route.spec, '/bannana' )
      t.equals(gg.examine(stack.grid, [1,2]).command.route.spec, '/cherry' )
      t.equals(gg.examine(stack.grid, [1,3]).command.route.spec, '/pineapple' )
      t.equals(gg.examine(stack.grid, [1,4]).command.route.spec, '/kiwi' )
      t.equals(gg.examine(stack.grid, [1,5]).command.route.spec, '/watermellon' )
    })


    test.skip('stack next() caller check', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.fire('stone', () => {
        //next()
      })

      stack.fire('wood', () => {
        //stack.next()
        stack.fire('paper', () => {
          //stack.next()
        })
      })

      //  stone | wood
      //          paper

      t.ok(gg.examine(stack.grid, 0).command.done)
      t.notOk(gg.examine(stack.grid, [0, 1]).command.done)
      t.ok(gg.examine(stack.grid, [1, 1]).command.done)
      //Wood is not done cause it never calls stack.next()
      //Stone and paper are both done cause their callbacks both call stack.next()
    })


    newTest('wait for loading...', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')
      let async = process.browser ? require('async') : requireUncached('async')

      var loaded = false

      stack.on('init', (next) => {
        async.series([
          (callback) => {
            next.fire('load', (next) => {
              setTimeout(() => { //< (simulate loading)
                t.pass('loading complete')
                loaded = true
                callback()
              }, 100)
            })
          },
          (callback) => {
            //This should wait for it's sibling to finish loading:
            next.fire('do-other-stuff', () => {
              console.log('now do other stuff')
              t.ok(loaded)
            })
          }
        ])
      })

      stack.fire('init')

      //cell check:
      setTimeout(() => {
        t.equals(  _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/init').cell, 0)
        //Both these commands are siblings of the original '/init' command:
        //TODO: cell placement visualization
        //t.equals(  _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/load').cell, 2)
        //t.equals(  _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/do-other-stuff').cell, 3)
      }, 200)
    })

    //TODO: handle a next.fire on command with no listeners better
    //or update this test:
    test.skip('stack.next for ons vs fires', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('apple', (next) => {
        next.fire('bannana')
      })

      stack.fire('apple')
      console.log(  gg.examine(stack.grid, 0) )
      t.ok(gg.examine(stack.grid, 0).command.done)  //< /bannana is done
      t.ok(gg.examine(stack.grid, 0).command.done) //< /apple is done
    })


    newTest('stack.next for ons vs fires pt2', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('cherry', (next) => {
        next.fire('date', (next) => {

        })
        //^ Both cherry and date should be incomplete;
        //date's listener/callback does not call next and
        //cherry is date's parent
      })
      stack.fire('cherry')

      t.notOk(gg.examine(stack.grid, [0, 1]).command.done)  //< date is not done
      t.notOk(gg.examine(stack.grid, 0).command.done) //< cherry is not done
      //actually date is done cause there is no middleware... if date was fired with a callback it would not be done.
    })


    newTest('stack.next for ons vs fires pt3', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('asparagus', (next) => {
        next.fire('bean-sprouts')
      })
      stack.fire('asparagus')
      console.log(   gg.examine(stack.grid, [0, 1]) )
      t.ok(  _.isNull(   gg.examine(stack.grid, [0, 1])  )   )  //< bean-sprouts is nowhere because there is no middleware, nor callback provided.
      console.log(   gg.examine(stack.grid, [0, 1]) )
      t.ok(gg.examine(stack.grid, 0).command.done) //< asparagus is done cause the next call ended it despite bean-sprouts not existing command
    })

    newTest('stack.next for ons vs fires pt4', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('bean-sprouts', () => {
        console.log('bean-sprouts in progress')
      })

      stack.on('asparagus', (next) => {
        next.fire('bean-sprouts')
      })
      stack.fire('asparagus')

      t.ok(gg.examine(stack.grid, [0, 1]).command.done)  //< bean-sprouts is done
      t.ok(gg.examine(stack.grid, 0).command.done) //< asparagus is done

    })


    newTest('stack.next for ons vs fires pt5', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('bean-sprouts', (next) => {
        console.log('bean-sprouts in progress')
        //next provided but not called
      })

      stack.on('asparagus', (next) => {
        next.fire('bean-sprouts', next)
      })

      stack.fire('asparagus')
      t.notOk(gg.examine(stack.grid, [0, 1]).command.done)  //< bean-sprouts is not done because next was not called during it's final callback.
      t.notOk(gg.examine(stack.grid, 0).command.done)
    })



    newTest('nested on/next situation', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('apple', (next) => {
        next.fire('orange')
      })
      stack.fire('apple')

      t.ok(gg.examine(stack.grid, 0).command.done )

    })

    newTest('ensure unrelated commands never share same column', (t) => {
      t.plan(7)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.fire('apple', (next) => {
        next.fire('green', (next) => next.fire('red', next))
      })

      stack.fire('berry', (next) => {
        next.fire('strawberry', (next) => next.fire('blueberry', (next) => next.fire('saskatoon', next)))
      })

      t.ok( gg.examine(stack.grid, 0).command.route.spec == '/apple')
      t.ok( gg.examine(stack.grid, [0,1]).command.route.spec == '/green')
      t.ok( gg.examine(stack.grid, [0,2]).command.route.spec == '/red')
      t.ok( gg.examine(stack.grid, [0,3]).command.route.spec == '/berry')
      t.ok( gg.examine(stack.grid, [0,4]).command.route.spec == '/strawberry')
      t.ok( gg.examine(stack.grid, [0,5]).command.route.spec == '/blueberry')
      t.ok( gg.examine(stack.grid, [0,6]).command.route.spec == '/saskatoon')

    })

    newTest('Ensure commands do not get doubled in the grid if only fired once', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('connect', () => {
        console.log('do something')
        //stack.next()
      })

      stack.on('connect', () => {
        console.log('do another thing')
        //stack.next()
      })

      stack.fire('connect', () => {
        t.pass(1)
        console.log(stack.grid.enties)
      })

      //this basic example does not reproduce the issue....

    })

    //Skipping for now until this is either passing or is noted in docs
    //(it's kind of a 'gotcha' something that could be unexpected)
    test.skip('Ensure commands do not get doubled in the grid if only fired once, specifically if they are using parameter', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      //Order is important here...
      //the parameter version 'on' needs to like reverse itself
      //though this could be a feature that is like not needed; or just a gotcha
      //to watch out for.

      stack.on('element/awesome-element/connected', () => {
        console.log('do another thing')
        //stack.next()
      })

      stack.on('element/:elementName/connected', () => {
        console.log('do something')
        //stack.next()
      })

      stack.fire('element/awesome-element/connected', () => {
        t.equals(stack.grid.enties.length, 1)
        console.log(stack.grid.enties)
      })

    })


    newTest('finish all middleware', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('save', (next) => {
        t.pass('save stuff')
        next.fire('elements/render')
      })

      stack.on('elements/render', () => {
        console.log('woot')
      })

      stack.on('save', () => {
        t.pass('save more stuff')
      })

      stack.fire('save')
    })

    newTest('finish all middleware (triple on)', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('/favvorite-main-save', (next) => {
        //next.fire('elements/render', next) //< TODO accommodate for this syntax
        next.fire('elements/render', (next) => next())
      })

      stack.on('/favvorite-main-save', () => {
        t.pass('first middleware invoked')
      })

      stack.on('favvorite-main-save', () => {
        t.pass('second middleware invoked')
      })

      stack.fire('/favvorite-main-save', () => {
        t.pass('command finished')
      })

    })

    newTest('Completion pyramid', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      stack.fire('first', (next) => {
        next.fire('second', (next) => {
          next.fire('third', (next) => {
            next.fire('fourth', (next) => {
              next.fire('fifth', (next) => {
                console.log('reached the end')
                t.pass()
              })
            })
          })
        })
      })
    })


    newTest('Middleware fires in correct order', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('go', () => {
        t.pass('first wildcard')
      })

      stack.on('go', () => {
        t.pass('second listener')
      })

      stack.on('go', () => {
        t.pass('third listener')
      })

      stack.fire('go')

    })


    newTest('Middleware fires in correct order (with wildcards)', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('*wild', () => {
        t.pass('first wildcard')
      })

      stack.on('go', () => {
        t.pass('go')
      })

      stack.on('*wild', () => {
        t.pass('second wildcard')
      })

      stack.fire('go')

    })


    newTest('All middleware fires', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false


      stack.on('click', (next) => {
        next.fire('init')
      })

      stack.on('init', () => {
        t.ok('do something')
      })

      stack.on('init', () => {
        t.ok('do another thing')
      })

      stack.fire('click')

    })

    newTest('Column logic cell placement into grid is based on fire order (and not on listener registration)', (t) => {
      t.plan(2)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.on('apples', () => {
        //need not run
      })

      stack.on('bannanas', () => {
        //need not run
      })

      stack.on('cherries', () => {
        t.pass()
      })

      stack.fire('cherries') //< fire cherries and ensure it starts on column 1

      var command = _.find(stack.commands, (command) => command.route.spec == '/cherries')
      t.equals( command.route.spec, '/cherries')

    })

    newTest('Stress test', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')

      stack.on('ready', (next) => {
        next.fire('init', next)
      })

      stack.on('init', () => console.log('init first'))

      stack.on('init', () => console.log('init second'))

      stack.on('init', (next) => {
        console.log('init third')

        next.fire('docs')
      })

      stack.on('init', () => {
        console.log('init fourth')

      })

      stack.on('docs', () => {
        console.log('docs first')

      })

      stack.on('docs', () => {
        console.log('docs second')

      })

      stack.on('docs', () => {
        console.log('docs third')

      })

      stack.fire('ready')

      t.pass('test finshes')

      setTimeout(() => {
        stack.grid = gg.xyCells(stack.grid)

        var thirdInit = gg.examine(stack.grid, [2, 1] )
        console.log(thirdInit)

        console.log(stack.grid.cells[13])

        //var fourthInit = gg.examine(stack.grid, [3, 1] )
        var fourthInit = stack.grid.cells[gg.xyToIndex(stack.grid, 5, 1)].enties[0]
        //TODO figure out why stack.grid, [3, 1] doesnt work... maybe gg.examine
        //is looking for column row and not row column...

        console.log(fourthInit)


        t.ok( thirdInit.done, "third 'init' callback is done")
        t.ok( fourthInit.done, "fourth 'init' callback is done")

        t.ok( _.find(stack.commands, (command) => command.route.spec == '/docs').done, "/docs command is done")
        t.ok( _.find(stack.commands, (command) => command.route.spec == '/init').done, "/init command is done")
        t.ok( _.find(stack.commands, (command) => command.route.spec == '/ready').done, "/ready command is done")

        //t.ok( stack.grid.cells[0].enties[0].command.done, "first 'ready' command is done")

      }, 1)

    })


    newTest('High volume of commands/listeners', (t) => {
      t.plan(1)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      stack.trimming = true

      var state = {}

      stack.on('selected-doc/selected', () => console.log('selected-doc/selected 1') )

      stack.on('selected-doc/selected', () => console.log('selected-doc/selected 2') )

      stack.on('selected-doc/selected', () => console.log('selected-doc/selected 3') )

      stack.on('save-note', (next) => {
        console.log('save-note 1')
        next.fire('docs', (next) => next.fire('selected-doc/selected') )
      })

      stack.on('save-note', () => console.log('save-note 2'))

      stack.on('save-note', () => console.log('save-note 3'))

      stack.on('keyboard/keydown', (next) => {
        console.log('keyboard/keydown 1')
        if(state.keydown === 'ESC') return next.fire('save-note')
        next()
      })
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 2') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 3') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 4') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 5') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 6') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 7') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 8') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 9') )
      stack.on('keyboard/keydown', () => console.log('keyboard/keydown 10') )

      stack.on('create-note', () => console.log('create-note 1') )

      stack.on('create-note', () => console.log('create-note 2') )

      stack.on('create-note', () => console.log('create-note 3') )

      stack.on('docs', () => console.log('docs 1'))

      stack.on('docs', () => console.log('docs 2'))

      stack.on('docs', () => console.log('docs 3'))

      stack.on('go-to-folder', (next) => {
        console.log('go-to-folder 1')
        next.fire('docs')
      })

      stack.on('go-to-folder', () => {
        console.log('go-to-folder 2')
      })

      stack.on('init', () => {
        console.log('init 1')
      })

      stack.on('init', (next) => {
        console.log('init 2')
        next.fire('go-to-folder')
      })

      stack.on('ready', (next) => {
        console.log('ready 1')
        next.fire('init')
      })

      stack.on('ready', () => {
        console.log('ready 2')
      })

      stack.fire('ready')

      stack.fire('create-note')

      stack.fire('keyboard/keydown') //T
      stack.fire('keyboard/keydown') //E
      stack.fire('keyboard/keydown') //S
      stack.fire('keyboard/keydown') //T

      state.keydown = 'ESC'
      stack.fire('keyboard/keydown') //ESC

      //Create another note!
      //TODO: fix failing / max call stack size exceeded....
      setTimeout(() => {
        stack.fire('create-note')

        stack.fire('keyboard/keydown') //T
        stack.fire('keyboard/keydown') //E
        stack.fire('keyboard/keydown') //S
        stack.fire('keyboard/keydown') //T

        state.keydown = 'ESC'
        stack.fire('keyboard/keydown') //ESC

        t.pass('finshed without crashing')

      }, 1000)

    })

    newTest('stack.fire executes syncronously if all listeners are synchronous', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      var going = false
      var stillGoing = false

      var executeSyncly = () => {
        console.log('executed syncly')
        going = true
      }
      var executeSynclyAgain = () => {
        stillGoing = true
        console.log('executed syncly (again)')
      }

      stack.on('go', executeSyncly )
      stack.on('go', executeSynclyAgain )

      stack.fire('go')

      t.ok(going && stillGoing)

    })



    test.skip('stack.fire executes asyncronously if next is used in a listener', (t) => {

    })


    newTest('One time callback is executed only once', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(1)

      stack.on('eat', () => {
        console.log('eating')
      })

      stack.fire('eat', () => {
        console.log('eat a little more... but only one time')
        t.pass()
      })

      stack.fire('eat')

    })


    newTest('One time callback is executed again if included again', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(2)

      stack.on('eat', () => {
        console.log('eating')
      })

      var fireEat = () => {
        stack.fire('eat', () => {
          console.log('eat a little more... but only one time (per command fired)')
          t.pass()
          //(test ensures this last callback is never skipped)
        })
      }

      fireEat()
      fireEat()
    })

    newTest('ttt', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(3)

      stack.on('something', () => t.pass('something happened'))

      stack.fire('something', (next) => {
        t.pass('something finshed')
        next()
      })

      //check that something command is done

      t.ok( _.every(stack.commands, (command) => command.done), 'all commands are done')

    })

    newTest('stack.every fires everytime', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(3)

      stack.on('something', () => console.log('something happened'))

      stack.on('another-thing', () => console.log('another thing happened'))

      stack.on('yet another-thing', () => console.log('yet another thing happened'))

      stack.every(() => t.pass() )

      stack.fire('something')

      stack.fire('another-thing')

      stack.fire('yet another-thing')

    })

    newTest('Grid expands to accommodate multiple incomplete listeners', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(9)

      stack.on('one', () => t.pass('one listened'))

      stack.on('two', () => {
        t.pass('listened for two')
      })

      stack.on('two', () => {
        stack.fire('two B')
      })

      stack.on('two B', () => {
        t.pass('listened for two B')
        stack.fire('two C')
      })

      stack.on('two B', () => {
        t.pass('listened for two B again')
      })

      stack.on('two B', () => {
        t.pass('listened for two B yet again')
        //^ if grid doesn't expand by multiple rows this one will get missed
      })

      stack.on('two C', () => t.pass('two C listened'))

      stack.on('two C', () => t.pass('two C listened again'))

      stack.on('two C', () => t.pass('two C listened yet again'))

      stack.on('two C', () => t.pass('two C listened even one more time'))


      stack.fire('one')

      stack.fire('two')


    })

    newTest('All listeners run (after a re-stack)', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      //let gg = process.browser ? require('gamegrids') : requireUncached('gamegrids')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(12)

      stack.on('keyboard/keydown', () => {
        stack.fire('create-note/save')
        t.pass('runs')
      })

      stack.on('create-note/save', () => {
        console.log('create-note/save')
        stack.fire('docs')
        t.pass('runs')
      })

      //These ones were not running correctly...
      stack.on('create-note/save', () => {
        console.log('create-note/save #2') //< this one would just repeat
        t.pass('runs')
      })

      stack.on('create-note/save', () => {
        console.log('create-note/save #3')
        t.pass('runs')
      })

      stack.on('create-note/save', () => {
        console.log('create-note/save #4')
        t.pass('runs')
      })

      stack.on('docs', () => {
        console.log('docs')
        t.pass('runs')
      })

      stack.on('docs', () => {
        console.log('docs #2')
        t.pass('runs')
      })

      stack.on('docs', () => {
        console.log('docs #3')
        stack.fire('selected-doc/selected')
        t.pass('runs')
      })

      stack.on('selected-doc/selected', () => {
        console.log('selected-doc/selected')
        t.pass('runs')
      })

      stack.on('selected-doc/selected', () => {
        console.log('selected-doc/selected #2')
        t.pass('runs')
      })

      stack.on('selected-doc/selected', () => {
        console.log('selected-doc/selected #3')
        t.pass('runs')
      })

      stack.on('selected-doc/selected', () => {
        console.log('selected-doc/selected #4')
        t.pass('runs')
      })

      stack.fire('keyboard/keydown')

    })

    newTest('stack.endCommand ends a command early', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(3)

      stack.on('green', () => {
        t.pass('listener 1')
      })
      stack.on('green', () => {
        t.pass('listener 2')
      })
      stack.on('green', () => {
        t.pass('listener 3')
        stack.endCommand()
      })
      stack.on('green', () => {
        t.fail('listener 4 (should not run!)')
      })
      stack.on('green', () => {
        t.fail('listener 5 (should not run!)')
      })

      stack.fire('green')

    })

    newTest('stack.before ensures listener runs before previously established listeners', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(2)

      var count = 0

      stack.on('one', () => {
        console.log('one')
        count++;
        t.ok(count == 2)
      })

      stack.before('one', () => {
        console.log('zero')
        count++;
        t.ok(count == 1)
      })

      stack.fire('one')

    })

    newTest('can supply an array of commands', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)
      stack.on(['jump-around', 'jumping'], () => t.pass('a jump has occurred'))
      stack.fire('jumping')
    })

    newTest('parameter routes fire (param route defined afer a related listener established)', (t)  => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(3)

      stack.on('keyup/f', () => {
        t.pass('f key explicity listener ran')
      })

      stack.on('/keyup/:key', () => {
        t.pass('keyup slash param listener ran')
        //(should run twice)
      })

      stack.fire('keyup/f')

      stack.fire('keyup/g')
    })


    newTest('Multiple parameter listeners fire when called', (t)  => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(2)

      stack.on('/keyup/:key', () => {
        t.pass('keyup slash param listener ran')
      })

      stack.on('/keyup/:key', () => {
        t.pass('keyup slash param listener ran again')
      })

      stack.fire('keyup/z')
    })

    newTest('Parameter commands store the actual parameter supplied', (t)  => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)

      stack.on('/fruit/:typeOfFruit', () => {
        t.equals(stack.params.typeOfFruit, 'apple', 'the type of fruit is apple')
      })

      stack.fire('fruit/apple')
    })

    newTest('Child commmand gets correct wild/paramter and then parent gets correct parameter after', (t)  => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(5)

      stack.on('vegetable/*typeOfVegetable', (next) => {
        t.equals(stack.params.wild, 'carrot', 'wild param is correct')
        t.equals(stack.params.typeOfVegetable, 'carrot', 'named param is correct')
        next.fire('material/wood', () => {
          console.log(stack.params)
          t.equals(stack.params.typeOfMaterial, 'wood', 'paramater is correct')
        })
      })

      stack.on('/material/:typeOfMaterial', () => {
        t.ok(stack.params.typeOfMaterial, 'child command has correct parameter')
        t.equals(stack.params.typeOfMaterial, 'wood', 'parameter is correct')
      })

      stack.fire('vegetable/carrot')
    })

    newTest('More complex listener arrangement involving stack.nth functions', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)

      let folderlistenersRanCount = 0
      let folderlistenerRan = () => {
        folderlistenersRanCount++
        console.log('ran')
      }

      stack.first('folder/*path', () => {
        console.log('we got a folder path!')
        folderlistenerRan()
      })

      stack.second('folder/*path', (next) => {
        //(after folder-navigation sets state.current_path)
        console.log('sort the folder tree...')
        folderlistenerRan()
        next.fire('folder-tree/render')
      })

      stack.on('folder-tree/render', () => {
        console.log('render folder tree')
      })

      stack.third('folder/*path', (next) => {
        folderlistenerRan()
        next.fire('docs-feed/render')
      })

      stack.on('folder/*path', () => {
        console.log('pathbar templating / render')
        folderlistenerRan()
      })

      stack.on('docs-feed/render', () => console.log('render docs feed'))

      stack.fire('folder/green')

      t.equals( folderlistenersRanCount, 4, 'Each folder/*path listener ran exactly once' )
    })

    newTest('Empty wildcard', (t)  => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(2)

      stack.on('folder/*path', (next) => {
        t.equals(stack.params.path, '', 'parameter is correct') //< in this case, path is blank
        console.log(stack.params)
        next.fire('move-to-column/test/2')
      })

      stack.on('move-to-column/:element/:column', () => {
        console.log(stack.params)
        t.equals(stack.params.element, 'test', 'paramater is correct')
      })

      stack.fire('folder/')
    })

    newTest('Fire that triggers commmand with parameter listener runs callback', (t)  => {
      global.stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(2)

      stack.on('/fruit/:typeOfFruit', () => {
        t.equals(stack.params.typeOfFruit, 'apple', 'the type of fruit is apple')
      })

      stack.fire('fruit/apple', () => {
        t.pass()
      })
    })


    newTest('Can run parameter command twice', (t)  => {
      global.stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(4)

      var executionCount = 0
      stack.on('/fruit/:typeOfFruit', () => {
        t.equals(stack.params.typeOfFruit, 'apple', 'the type of fruit is apple')
        executionCount++
        t.pass('ran the listener ' + executionCount + ' times')
      })

      stack.fire('fruit/apple')
      stack.fire('fruit/apple')

    })

    newTest('Multiple parameter listeners fire when called twice', (t)  => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(4)

      stack.on('/keyup/:key', () => {
        t.pass('keyup slash param listener ran')
      })

      stack.on('/keyup/:key', () => {
        t.pass('keyup slash param listener ran again')
      })

      stack.fire('keyup/z')
      stack.fire('keyup/z')
    })


    newTest('Async next.fire within a seconary listener runs asyncronously (after a previous async execution)', (t)  => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(4)

      var executionCount = 0

      stack.on('init', (next) => {
        console.log('init db...')
        next.fire('start-server')
      })

      stack.on('load/:database', (next) => {
        console.log('load database...')
        setTimeout(() => {
          t.pass('database loaded (should run first)')
          executionCount++
          next()
        }, 1000)
      })

      stack.on('start-server', (next) => {
        setTimeout(() => {
          console.log('server started')
          next()
        }, 1000)
      })

      stack.on('load/:database', () => {
        t.pass('post database loaded listener ran (should run second)')
        executionCount++
        t.equals(executionCount, 2)
      })

      stack.on('init', (next) => {
        console.log('init complete')
        next.fire('load/apple-inventory', () => {
          t.equals(executionCount, 2)
        })
      })

      //stack.fire('load/apple-inventory')
      stack.fire('init')
    })

    newTest('Wildcard listener makes its path available', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)

      stack.on('*anything', () => {
        console.log('do something')
        t.equals(stack.params.wild, 'something')
      })

      stack.fire('something')

    })


    newTest('wildcard test', (t)  => {
      console.log('whatup')
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)

      stack.on('init', () => {
        t.pass('first init')
      })

      stack.on('folder/*', () => {
        t.fail('should not fire')
      })

      stack.fire('init')

    })

    newTest('stack.once works as expected', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(3)
      let goCount = 0
      stack.once('go', () => {
        console.log('go!')
        goCount++
      })

      stack.fire('go')
      stack.fire('go')
      stack.fire('go')
      t.equals(goCount, 1, '"go" only invoked once')

      let jumpCount = 0
      stack.on('jump', () => {
        console.log('jump!')
        jumpCount++
      })

      stack.once('jump', () => {
        console.log('jump around!')
        jumpCount++
      })

      stack.fire('jump')
      stack.fire('jump')

      t.equals(jumpCount, 3, '"jump" invoked a regular listener on the 2 fires and then a third listener invoked on just one of those fires')

      let attackCount = 0
      stack.on('attack/*type', () => {
        console.log(stack.params.wild + ' it!')
        attackCount++
      })

      stack.once('attack/*type', () => {
        console.log(stack.params.wild + ' it!')
        attackCount++
      })

      stack.fire('attack/kick')
      stack.fire('attack/punch')

      t.equals(attackCount, 3, '"attack/*type" invoked 3 times')

    })


    newTest('stack.before works even if no existing command', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      stack.before('dinosaurs', () => t.ok('fired before dinosaurs'))
      stack.fire('dinosaurs')
    })

    newTest('Command can be fired with an object body/payload/parameter', (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      //async alt:
      stack.on('green', () => {
        t.ok( _.isObject( stack.params.body ))
        t.equals(stack.params.body.hex, '#008000', 'object has expected property')
      })

      stack.fire('green', { hex : '#008000' })

      //or with just a string:
      stack.on('red', () => {
        t.ok( _.isString( stack.params.body ))
        t.equals(stack.params.body, '#ff0000', 'body has expected value ')
      })
      stack.fire('red', '#ff0000')
    })


    newTest('Aliasing/shorthand feature', (t) => {
      t.plan(5)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      const fire = new stack.aliaser()

      stack.on('init-multi-game', () => {
        t.pass('using named function same as firing the original path')
      })

      fire.initMultiGame()

      //with param (body)
      stack.on('render-page', () => {
        t.ok( _.isObject( stack.params.body) && stack.params.body.title == 'Smurftown', 'parameter works')
      })
      fire.renderPage({ title: 'Smurftown' })

      //with named params:
      stack.on('ui-grid/insert/:row/:column', () => {
        t.pass('listener ran')
        t.equals(stack.params.row, '1', 'first param correct')
        t.equals(stack.params.column, '2', 'second param correct')
      })

      fire.uiGridInsert(1, 2)

      //TODO with named params + body

    })


    test.skip('Wildcards and folders', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(4)
      stack.on(['folder/*path', 'docs-feed-render'], () => t.pass('folder/* (in an array with 1 other listener) listened') )
      stack.on('folder/*path', () => t.pass('folder/*path listened'))
      stack.on('folder/games', () => t.pass('folder/games listened'))
      stack.on('folder/*') //< TODO: make sure this catches too
      stack.fire('folder/')
    })

    newTest('stack.first() happens before regular listeners', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      let count = 0

      stack.on('green', () => {
        console.log('hit gas')
        count++
        t.equals(count, 2)
      })

      stack.on('green', () => {
        console.log('go')
        count++
        t.equals(count, 3)
      })

      stack.first('green', () => {
        console.log('look both ways')
        count++
        t.equals(count, 1)
      })

      stack.fire('green')

    })


    newTest('stack.first() happens, then stack.second() and so forth', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

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

    newTest('stack.second() plays nice with existing listeners without pre-defined priority', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      let step = 0

      stack.on('fireworks', () => {
        console.log('light match')
        step++
        t.equals(step, 1)
      })

      stack.second('fireworks', () => {
        console.log('run!')
        step++
        t.equals(step, 2)
      })

      stack.fire('fireworks')

    })


    newTest('stack.nth("command", 99) always runs last', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      let step = 0

      stack.on('coffee', () => {
        console.log('boil water')
        step++
        t.equals(step, 1)
      })

      stack.nth('coffee', 99, () => {
        console.log('drink coffee!')
        step++
        t.equals(step, 5)
      })

      stack.on('coffee', () => {
        console.log('steep')
        step++
        t.equals(step, 3)
      })

      stack.second('coffee', () => {
        console.log('grind beans')
        step++
        t.equals(step, 2)
      })

      stack.on('coffee', () => {
        console.log('pour cream')
        step++
        t.equals(step, 4)
      })

      stack.fire('coffee', () => {
        console.log('mmm that was tasty')
        step++
        t.equals(step, 6)
      })

    })

    newTest('Listener can fire a new command of same name within trailing callback without calling said trailing callback again', (t) => {

      //test.only('Listener can fire a new command of same name within trailing callback without calling said trailing callback again ', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false

      t.plan(2)

      let normalListenerCount = 0
      let trailingCallbackCount = 0
      stack.on('make-block', (next) => {
        next.fire('create-block', (next) => {
          trailingCallbackCount++
          next.fire('create-block', (next) => {
            trailingCallbackCount++
            next.fire('ship-block')
          })
        })
      })

      stack.on('create-block', () => {
        normalListenerCount++
      })

      stack.fire('make-block')

      t.equals(normalListenerCount, 2)
      t.equals(trailingCallbackCount, 2)
    })

    newTest('More complex listener within a listener (invovling params)', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)

      stack.on('init', () => console.log('/init regular listener'))

      stack.on('draggable-absolute-separator/init/:cellNum', () => console.log('/draggable-absolute-separator/init regular listener'))

      stack.on('folder', () => console.log('/folder regular listener'))

      stack.on('folder-tree/refresh', ()=> {
        console.log('/folder-tree/refresh regular listener')
        t.pass()
      })

      stack.fire('init', (next) => {
        console.log('/init trailling listener')
        next.fire('folder', (next) => {
          console.log('/folder trailing listener')
          next.fire('draggable-absolute-separator/init/3', (next) => {
            console.log('draggable-absolute-separator/init trailing listener (first fire)')
            next.fire('draggable-absolute-separator/init/4', (next) => {
              console.log('draggable-absolute-separator/init trailing listener (second fire)')
              next.fire('folder-tree/refresh')
            })
          })
        })
      })
    })

    newTest('stack.first() as an array of paths', (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.trimming = false
      t.plan(1)
      let runCount = 0
      stack.on('run', () => {
        runCount++
        console.log('stack.on test happened')
      })
      stack.first(['run', 'run2'], ()=> {
        runCount++
        console.log('stack.first test happened')
        t.equals(runCount, 1)
      })
      stack.fire('run')
    })

    test.skip("Can use Coalan's Async lib within a stack listener", (t) => {
      t.plan(10)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      let async = process.browser ? require('async') : requireUncached('async')

      //can run an asyncEach within a stack fire; calling stack.next at each point...
      stack.on('delete-item', (next) => {
        t.pass('talking to database')
        setTimeout(next, 10)
      })

      stack.fire('delete-item', () => {
        t.pass('deleted single item')
      })

      //2 passes there, but now lets try to delete 6 items asynchronoulsy
      stack.on('delete-all-items', (next) => {

        let items = _.map( _.range(6), (item, index) => 'item' + index )

        console.log(items)

        async.eachSeries(items, (item, callback) => {
          console.log(item)
          //next.fire('delete-item', callback) //< you can't use shorthand
          next.fire('delete-item', () => callback())
        }, () => {
          t.pass('finished deleting all items')
          next()
        })
      })

      stack.fire('delete-all-items', () => {
        t.pass('finished stack command')
      })

    })

    newTest("Stack.fire on a command that does not exist still passes next", (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      let async = process.browser ? require('async') : requireUncached('async')
      stack.on('ice', (next) => {
        next.fire('water')
      })

      stack.fire('ice', () => {
        t.ok('finishes')
      })
    })

    newTest("stack.params retain between child fires", (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      stack.on('move/:direction', (next) => {
        t.equals(stack.params.direction, 'north')
        next.fire('enter-new-world/' + stack.params.direction)
      })

      stack.on('enter-new-world/:direction', () => {
        t.equals(stack.params.direction, 'north')
      })

      stack.fire('move/north')
    })

    newTest("stack.params clear after subsequent (non-child) fires", (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      stack.on('ui-grid/insert/3/3/:elementName', () => {
        t.equals(stack.params.elementName, 'path-bar')
      })

      stack.fire('ui-grid/insert/3/3/path-bar')

      console.log(stack.params)
      t.ok(_.isEmpty(stack.params))

    })

    //this one fires out of order ...
    newTest("Explicit listener works in combination with a listener with same pattern but using parameter", (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      stack.on('keyup/:anyKey', () => {
        t.pass('any key was hit')
      })

      stack.on('keyup/:anyKey', () => {
        t.pass('any key was hit (2nd listener invoked)')
      })

      stack.on('keyup/Backspace', (next) => {
        t.pass('backspace was hit')
        next()
      })

      stack.fire('keyup/Backspace')
    })


    newTest("No doubling up of one time listener/trailing callbacks", (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      stack.on('player-movement/:direction', (next) => {
      	console.log('player-movement/' + stack.params.direction)
        next.fire('world-grid-create-new/' + 44, (next) => {
          //should only run twice:
          t.pass('world-grid-create-new/' + stack.params.cellNum + ' trailing callback ran' )
          next.fire('enter-next-world-grid/' + stack.params.direction)
        })
      })

      stack.on('world-grid-create-new/:cellNum', () => {
        t.pass('world-grid-create-new/' + stack.params.cellNum + ' regular listener ran' )
      })

      stack.on('enter-next-world-grid/:direction', () => {
        t.pass('enter-next-world-grid/' + stack.params.direction + ' regular listener ran' )
      })

      stack.fire('player-movement/north')
      stack.fire('player-movement/north')

    })

    newTest("Original params restored after child command completes", (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      stack.on('save-favv/:id', (next) => {
      	console.log('whatup')
      	next.fire('save-list-to-db')
      })

      stack.on('save-list-to-db', () => {
        console.log('do stuff')
      })

      stack.on('save-favv/:id', () => {
        t.ok(_.isObject(stack.params))
      	t.equals(stack.params.id, 'Morrowind')
      })

      stack.fire('save-favv/Morrowind')

    })

    newTest('Params restore to original command after two children commands execute', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

    	stack.on('mouse/click/mf-doc', (next) => {
        console.log('mouse/click/mf-doc')
        next.fire('selectable-docs/select/abc')
    	})

      stack.on('selectable-docs/select/:docId', (next) => {
        console.log('1st param listener')
        t.equals(stack.params.docId, 'abc')
        next.fire('selectable-docs/deselect')
      })

      stack.on('selectable-docs/select/:docId', () => {
        console.log('2nd param listener')
        t.equals(stack.params.docId, 'abc')
      })

      stack.on('selectable-docs/deselect', () => {
        console.log("third command's first listener")
      })

      stack.on('selectable-docs/deselect', (next) => {
        console.log("third command's second listener")
        next.fire('property-panel/render')
      })

      stack.on('property-panel/render', () => {
        console.log("fourth command's only listener")
        console.log('woot woot')
      })

      stack.fire('mouse/click/mf-doc')

    })

    newTest('Double nested fire trailing callback runs after', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      stack.on('keyup/e', (next) => {
        next.fire('/edit-selected-doc')
      })

      stack.on('edit-selected-doc', (next) => {
        t.pass('edit!')
        next.fire('create-note', () => { //< gets called twice
          t.pass('re-populate and focus!')
        })
      })

      stack.on('selectable-docs/deselect', () => console.log('/selectable-docs/deselect'))

      stack.first(['create-note','create-folder'], (next) => next.fire('selectable-docs/deselect'))

      stack.fire('create-note')
      stack.fire('keyup/e')

    })

    newTest('Can fire an async function from another library', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      let PouchDB = require('pouchdb')
      PouchDB.plugin(require('pouchdb-adapter-memory'));
      let db = new PouchDB('test', {adapter: 'memory'})
      stack.libraries.push(db)

      //before:
      stack.on(db.post, () => {
        console.log('w000t')
        t.pass()
      })

      var doc = { _id : 'blue', testing : true, subject : 'awesomeness' }

      stack.on('create-note/save',  (next) => {
        next.fire(db.post, doc, (next) => {
          //after function runs
          if(stack.err) return console.log(stack.err)
          console.log(stack.res)
          t.ok(stack.res)

          console.log('latest doc saved to db.')

          db.get('blue', (err, res) => {
            if(err) return console.warn(err)
            console.log(res)
            doc._rev = stack.res.rev
            next()
          })

        })
      })

      stack.on('create-note/save', () => {
        console.log('this should run last and have the latest doc data from db:')
        console.log(doc)
        t.ok(doc._rev)
      })

      stack.fire('create-note/save')

      //todo: make another assertion/check that there are 3 listeners in total for function/post (the explicit on listener we established, a listener that wraps and executes the function itself and a trailing callback)

    })

    newTest('Can fire the same async lib function again', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      let PouchDB = require('pouchdb')
      PouchDB.plugin(require('pouchdb-adapter-memory'));
      let db = new PouchDB('test', {adapter: 'memory'})
      stack.libraries.push(db)

      //each of these should run twice:
      stack.on(db.post, () => {
        t.pass('regular listener A ran (this should run twice)')
      })

      stack.on(db.post, () => {
        t.pass('regular listener B ran (this should run twice)')
      })

      stack.fire(db.post, { _id : 'red', hot: true }, (next) => {
        if(stack.err) return console.log(stack.err)
        t.equals(stack.res.id, 'red')
        next.fire(db.post, { _id : 'green', organic : true }, (next) => {
          if(stack.err) return console.log(stack.err)
          t.equals(stack.res.id, 'green')
        })
      })
    })

    newTest('Lib function fires without any pre-existing .on listener', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      let PouchDB = require('pouchdb')
      PouchDB.plugin(require('pouchdb-adapter-memory'));
      let db = new PouchDB('test', {adapter: 'memory'})
      stack.libraries.push(db)

      console.log('pushed db library')

      stack.on('create-note/save', (next) => {
        console.log('create-note/save')
        next.fire(db.post, doc, (next) => {
          if(stack.err) return console.log(err)
          console.log('doc saved to db.')
          t.ok(stack.res) //< check that there is a response obj
          t.ok(stack.res && stack.res.rev) //< and that it has data returned from db
          next()
        })
      })

      let doc = {
        _id : 'test',
        content : 'this is a test',
        date : Date.now()
      }
      //do a db operation the normal way:
      db.post(doc, (err, res) => {
        console.log('db post natively')
        //update with rev so we can put it back again after another change...
        doc._rev = res.rev
        //now fire it so the stack tek can try putting:
        stack.fire('create-note/save', ()=> {
          t.pass('fire complete')
        })
      })
    })

    newTest('Lib function retains changes to stack.params.body between fires', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      let PouchDB = require('pouchdb')
      PouchDB.plugin(require('pouchdb-adapter-memory'))
      let db = new PouchDB('test', {adapter: 'memory'})
      stack.libraries.push(db)
      let _ = require('underscore')

      let pick = ['_id', '_rev', 'date', 'content'] //(only save this info to db)

      stack.on(db.post, () => {
        // let entiesInProgress =  _.findWhere(stack.grid.enties, (enty) => { underway : true })
        let stackCommandInProgress = _.findWhere(stack.grid.enties, (enty) => { underway : true }).command
        debugger
        //let stackCommandInProgress = stack.liveListener()

        //check that stack.params is reference to obj on the command
        //(so changes to it will affect that of the command; ideal for persisting mutations down the stack for other listeners or subsequent fires)
        t.equals(stack.params.body, stackCommandInProgress.params.body, 'stack.params is referencing the same obj as the param obj of current command in progress')
        debugger
        stack.params.body = _.pick(stack.params.body, pick)
        t.notOk( stack.params.body.temporary_stuff_not_intended_for_db, 'temporary data removed from stack.params.body')
        console.log('did it work')
      })

      stack.on('create-note/save', (next) => {
        console.log('create-note/save')
        next.fire(db.post, doc, (next) => {
          if(stack.err) return console.log(err)
          console.log('doc saved to db (via stack)')
          t.notOk( stack.params.body.temporary_stuff_not_intended_for_db, 'change to stack.params.body was retained')
          next()
        })
      })

      let doc = {
        _id : 'test2',
        content : 'this is another test', //some data we don't want:
        temporary_stuff_not_intended_for_db : 73737143123124,
        date : Date.now()
      }
      //do a db operation the normal way:
      db.post(doc, (err, res) => {
        console.log('db post natively')
        //update with rev so we can put it back again after another change...
        doc._rev = res.rev
        //change content:
        //now fire it so the stack tek can try putting (with an intercepting listener to filter out temporary_stuff):
        debugger
        stack.fire('create-note/save')
      })
    })

    newTest('stack.last occurs before the trailing callback', (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      let count = 0
      stack.last('something', () => {
        count++
        console.log('this should occur before the trailing callback')
      })
      stack.fire('something', () => {
        count++
        console.log('this should actually occur last')
        t.equals(count, 2)
      })

      //now try async
      let anotherCount = 0

      stack.last('something-else', (next) => {
        setTimeout(() => {
          anotherCount++
          console.log('this should occur before the trailing callback')
          next()
        }, 200)
      })

      stack.fire('something-else', () => {
        anotherCount++
        console.log('this should actually occur last (again)')
        t.equals(count, 2)
      })

      //now try async with a nextfire (2 assertions):
      let yetAnotherCount = 0

      stack.last('something-else-yet-again', (next) => {
        setTimeout(() => {
          yetAnotherCount++
          t.equals(yetAnotherCount, 1)
          console.log('this should occur before the trailing callback')
          next()
        }, 200)
      })

      stack.on('something-else-again', (next) => {
        next.fire('something-else-yet-again', () => {
          yetAnotherCount++
          console.log('this should actually occur last (yet again)')
          t.equals(yetAnotherCount, 2)
        })
      })
      stack.fire('something-else-again')
    })

    newTest('stack.params.body retained with array parameter based listeners', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')

      stack.on('selectable-docs/deselect', () => {
        console.log('do some stuff')
      })

      stack.on('create-note', (next) => {
        next.fire('selectable-docs/deselect')
      })

      stack.on('create-note', () => {
        t.ok(stack.params.body, 'stack.params.body retained')
        t.equals(stack.params.body, 'The sky is blue.', 'retained value is correct')
      })

      stack.fire('create-note', 'The sky is blue.')
    })

    //run only a specific test by name:
    if(testName) {
      let testToRun = _.findWhere(testObj.tests, { name : testName })
      testObj.only = testToRun
    }

    //run test immediately...
    if(run) {
      console.log('run tests...')
      if(testObj.only) { //Only run the one test:
        return testObj.only.func(testObj.only.name)
      }
      testObj.tests.forEach((entry) => { //< otherwise run all tests
        entry.func(entry.name)
      })
    }

    //Only send the one test:
    if(testObj.only) return [testObj.only]

    return testObj.tests
  }
}

if(process.browser) window.testObj = testObj

module.exports = testObj
