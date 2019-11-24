module.exports = (test, stack) => {
  test("Mulitiple listeners invoke in a series (not parallel)", (t) => {
    t.plan(3)

    let state = {}

    stack.on('/boot', () => {
      t.equals(stack.path(), '/boot', 'first boot listener ran')
      state.booting = true
    })

    stack.on('/boot', () => {
      t.ok(stack.path(), '/boot', 'second boot listener ran')
      t.ok(state.booting, 'variable set on state during first listener exists with expected value')
    })

    stack.fire('/boot')
  })
}