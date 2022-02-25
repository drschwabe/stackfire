module.exports = (test, stack) => {
  test('stack.fire executes syncronously if all listeners are synchronous', (t) => {
    t.plan(1)

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
}
