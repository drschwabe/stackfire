module.exports = (test, stack) => {

  test("Parameter test", (t) => {
    t.plan(3)

    stack.on('/inventory/:item/deliver', () => {
      t.equals(stack.path(), '/inventory/widget/deliver', 'expected listener invoked')
      t.equals(stack.params().item, 'widget', 'parameter is included on the command')
    })

    //This should not run:
    stack.on('/inventory/:item/destroy', () => {
      t.fail('listener invoked when it should not have')
    })

    stack.fire('/inventory/widget/deliver', () => {
      t.pass('end of stack reached')
    })

  })
}