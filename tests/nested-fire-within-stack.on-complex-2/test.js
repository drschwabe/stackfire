module.exports = (test, stack) => {
  test("stack.fire nested within stack.on (complex 2)", (t) => {
    t.plan(7)

    stack.on('strawberry', () => {
      console.log('/strawberry "on" (listener function in progress)')
    })

    stack.on('orange', () => {
      console.log('/orange "on" (listener function in progress)')
      t.ok(stack.path(), '/orange')
    })

    stack.on('orange', () => {
      console.log('/orange again')
      t.ok(stack.path(), '/orange')
    })

    stack.on('orange', (next) => {
      console.log('/orange yet again!')
      t.ok(stack.path(), '/orange')
      next.fire('grapefruit')
    })

    stack.on('/grapefruit', () => {
      console.log('/grapefruit "on" listener in progress.')
      t.ok('root level listener invoked from a nested fire')
    })

    stack.on('/grapefruit', () => {
      console.log('/grapefruit again')
      t.equal(stack.path(), '/grapefruit', "state.path equals the path of the current 'on' listener.")
    })

    stack.on('orange', () => {
      console.log('/orange again (should occur after grapefruit listeners)')
      t.ok(stack.path(), '/orange')
      //t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [4, 1]), 'orange first listener after grapefruit command assigned to correct cell')
    })

    stack.on('orange', () => {
      console.log('/orange last time!')
      t.ok(stack.path(), '/orange')
      //t.equal(stack.cell.num, gg.xyToIndex(stack.grid, [5, 1]), 'orange second listener after grapefruit assigned to correct cell')
    })

    console.log('about to fire /strawberry')
    stack.fire('strawberry')

    console.log('about to fire /orange')
    stack.fire('orange')

    //t.equal(stack.grid.cells[14].enties[0].command.route.spec, '/grapefruit')
   // t.equal(stack.grid.cells[20].enties[0].command.route.spec, '/grapefruit')

  })
}