module.exports = (test, stack) => {
  test('stack.fire executes syncronously if all listeners are synchronous', (t) => {
    t.plan(1)

    var going = false
    var stillGoing = false
    var yetGoingStill= false 

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

    const result = stack.fire('go', () => {
      yetGoingStill = true 
      console.log('executed callback')
      return yetGoingStill
    })

    console.log(result)

    t.ok(going && stillGoing && yetGoingStill)
  })
}
