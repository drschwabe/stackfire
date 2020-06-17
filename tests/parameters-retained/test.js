module.exports = (test, stack) => {

  test("Parameters retained after multiple fires", t => {
    t.plan(1)

    stack.on('mouse/click/mf-doc', next => {
      next.fire('selectable-docs/select/77777777777')
    })

    stack.on('selectable-docs/select/:docId', () => {
      t.equals(stack.params().docId, '77777777777', 'parameter is as expected')
    })

    stack.fire('mouse/click/mf-doc')

  })
}
