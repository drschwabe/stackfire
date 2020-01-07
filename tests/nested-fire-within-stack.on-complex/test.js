module.exports = (test, stack) => {

  test("stack.fire nested within stack.on (complex)", (t) => {
    t.plan(7)

    stack.on('orange', () => {
      console.log('orange "on" (listener function in progress)')
      t.equals(stack.path(), 'orange')
    })

    stack.on('orange', () => {
      console.log('orange again')
      t.equals(stack.path(), 'orange')
    })

    stack.on('orange', (next) => {
      console.log('orange yet again!')
      t.equals(stack.path(), 'orange')
      //next(  stack.fire('grapefruit') )
      next.fire('grapefruit')
    })

    stack.on('grapefruit', () => {
      console.log('grapefruit "on" listener in progress.')
      //t.ok(stack.state, 'root level listener invoked from a nested fire')
      t.equals(stack.path(), 'grapefruit')
      //next()
    })

    stack.on('grapefruit', () => {
      console.log('grapefruit again')
      t.equal(stack.path(), 'grapefruit', "state.path equals the path of the current 'on' listener.")
      //next()
    })

    stack.on('orange', () => {
      console.log('orange again (should occur after grapefruit listeners)')
      t.equals(stack.path(), 'orange')
      //t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [4,0]), 'orange first listener after grapefruit command assigned to correct cell')
    })

    stack.on('orange', () => {
      console.log('/orange last time!')
      t.equals(stack.path(), 'orange')
      //t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [5,0]), 'orange second listener after grapefruit assigned to correct cell')
    })

    console.log('about to fire orange')
    stack.fire('orange')

    //t.equal(stack.grid.cells[13].enties[0].command.route.spec, '/grapefruit')
    //t.equal(stack.grid.cells[19].enties[0].command.route.spec, '/grapefruit' )

    //t.ok( _.every(stack.commands, (command) => command.done), 'all commands are done')
  })
}