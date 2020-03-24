module.exports = (test, stack) => {

  test("Parameters retained after multiple fires (complex)", t => {
    t.plan(2)

    stack.on('mouse/click/mf-doc', next => {
      next.fire('selectable-docs/select/77777777777')
    })

    stack.on('selectable-docs/select/:docId', next => {
      t.equals(stack.params().docId, '77777777777', 'parameter is as expected')
      next.fire('selectable-docs/deselect')
    })

    stack.on('selectable-docs/select/:docId', () => {
      t.equals(stack.params().docId, '77777777777', 'parameter remains as expected (2nd listener)')
    })

    stack.on('selectable-docs/deselect', () => {
      console.log('selectable-docs/deselect')
    })

    stack.fire('mouse/click/mf-doc')

  })
}