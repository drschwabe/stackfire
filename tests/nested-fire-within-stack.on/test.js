module.exports = (test, stack) => {
  test("stack.fire nested within stack.on", (t) => {
    t.plan(2)

    stack.on('apple', (next) => {
      console.log('apple "on" (listener function in progress).')
      t.equal(stack.path(), '/apple', "stack.path() equals the path of the current 'on' listener.")
      next.fire('bannana')
    })

    stack.on('bannana', () => {
      console.log('bannana "on" listener in progress. state.path:')
      t.equal(stack.path(), '/bannana', "stack.path() equals the path of the current 'on' listener.")
      //at this point, apple is done too
    })
    console.log('about to fire apple')
    stack.fire('apple')

    return

    t.ok( stack.grid.cells[0].enties[0].done , 'Original command is immediately done')
    setTimeout( () => {
      t.ok( stack.grid.cells[0].enties[0].done , 'Original command is done (after checking again with some setTimeout delay)')
    }, 2)
  })
}